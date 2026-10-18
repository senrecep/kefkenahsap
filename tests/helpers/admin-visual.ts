import type { Page } from '@playwright/test'

/**
 * #167: visual defects the 48px tap-target rules (custom.scss) can cause, found in the rendered admin.
 * - enlarged-visible-hit-area: a painted box (background or border, at rest or on hover) that our 48px rules made
 *   bigger than Payload's own. Tap areas must grow invisibly; only text fields and labelled buttons/rows may grow.
 * - overlap: a visible control on another control, or on text it does not own, within one layer.
 * - tap-area: a control's (invisible) 48px tap area clipped by an ancestor or covered by a neighbour.
 */
export async function visualProblems(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const out: string[] = []
    const SEL =
      'a[href],button,input:not([type=hidden]):not([type=file]),select,textarea,summary,[role=button],[role=tab],[role=checkbox],.clear-indicator,.multi-value'
    // Painted boxes that may be taller than Payload's: fields, labelled buttons and the 48px segments attached to them
    // (publish ⌄, relation +), menu and nav rows, tabs, chips, table cells.
    const MAY_GROW =
      'input,select,textarea,.rs__control,.rs__option,.rs__multi-value,.btn:not(.btn--icon-only),.nav__link,.nav a,.tabs-field__tab-button,.popup-button-list__button,.radio-input,.ai-btn,td,th,tr,.rs__menu,.relationship-add-new__add-button,.btn--withPopup .popup-button'

    const alpha = (c: string) => (c === 'transparent' ? 0 : c.startsWith('rgba') ? Number(c.split(',')[3]?.replace(')', '')) : 1)
    const name = (el: Element) => {
      const label = (el.getAttribute('aria-label') || el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 24)
      return `${el.tagName.toLowerCase()}.${[...el.classList].slice(0, 2).join('.')} "${label}"`
    }
    const visible = (el: Element) => {
      const r = el.getBoundingClientRect()
      return r.width > 0 && r.height > 0 && el.checkVisibility({ opacityProperty: true, visibilityProperty: true }) && !el.closest('[aria-hidden=true],[inert]')
    }
    const paintsAtRest = (el: Element) => {
      const cs = getComputedStyle(el)
      const border = ['Top', 'Right', 'Bottom', 'Left'].some(
        (s) => parseFloat(cs.getPropertyValue(`border-${s.toLowerCase()}-width`)) > 0 && alpha(cs.getPropertyValue(`border-${s.toLowerCase()}-color`)) > 0,
      )
      return alpha(cs.backgroundColor) > 0.05 || border
    }
    // Rules that paint a background only on :hover (e.g. Payload's round array "…" button), collected once.
    const hoverSelectors: string[] = []
    const collect = (rules: CSSRuleList) => {
      for (const rule of rules) {
        if (rule instanceof CSSStyleRule) {
          if (rule.selectorText.includes(':hover') && /background/.test(rule.style.cssText) && !/transparent|none/.test(rule.style.background || rule.style.backgroundColor))
            for (const s of rule.selectorText.split(',')) if (s.includes(':hover')) hoverSelectors.push(s.replace(/:hover/g, '').trim())
        }
        if ('cssRules' in rule && (rule as CSSGroupingRule).cssRules) collect((rule as CSSGroupingRule).cssRules)
      }
    }
    for (const sheet of document.styleSheets)
      try {
        collect(sheet.cssRules)
      } catch {
        // Cross-origin sheet: not ours.
      }
    const valid = hoverSelectors.filter((sel) => {
      try {
        return sel !== '' && (document.querySelector(sel), true)
      } catch {
        return false
      }
    })
    const hoverPainted = new Set(valid.length ? document.querySelectorAll(valid.join(',')) : [])
    const paintsOnHover = (el: Element) => hoverPainted.has(el)

    const union = (rects: DOMRect[]) => {
      const rs = rects.filter((r) => r.width > 0 && r.height > 0)
      if (!rs.length) return null
      const l = Math.min(...rs.map((r) => r.left)), t = Math.min(...rs.map((r) => r.top))
      return new DOMRect(l, t, Math.max(...rs.map((r) => r.right)) - l, Math.max(...rs.map((r) => r.bottom)) - t)
    }
    // The box that takes taps: the element's own box plus an absolutely positioned ::after (custom.scss `hit-area`).
    const hitBox = (el: Element) => {
      const r = el.getBoundingClientRect()
      const a = getComputedStyle(el, '::after')
      if (a.content === 'none' || a.position !== 'absolute') return r
      const cs = getComputedStyle(el)
      const left = r.left + parseFloat(cs.borderLeftWidth) + parseFloat(a.left)
      const top = r.top + parseFloat(cs.borderTopWidth) + parseFloat(a.top)
      return union([r, new DOMRect(left, top, parseFloat(a.width), parseFloat(a.height))])!
    }
    const texts: { node: Text; parent: Element; rect: DOMRect }[] = []
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
    for (let n = walker.nextNode() as Text | null; n; n = walker.nextNode() as Text | null) {
      // Transparent text is screen-reader-only (Payload's "Bloğu aç/kapat").
      if (!n.textContent?.trim() || !n.parentElement || !visible(n.parentElement) || alpha(getComputedStyle(n.parentElement).color) === 0) continue
      const range = document.createRange()
      range.selectNodeContents(n)
      let rect = range.getBoundingClientRect()
      // Truncated text is only visible inside the box that clips it (ellipsis); screen-reader-only text is a 1px box.
      for (let e: Element | null = n.parentElement, i = 0; e && i < 4; e = e.parentElement, i++) {
        const cs = getComputedStyle(e)
        if (cs.overflow === 'visible' && cs.clip === 'auto') continue
        const c = e.getBoundingClientRect()
        const l = Math.max(rect.left, c.left), t = Math.max(rect.top, c.top)
        rect = new DOMRect(l, t, Math.min(rect.right, c.right) - l, Math.min(rect.bottom, c.bottom) - t)
      }
      if (rect.width > 1 && rect.height > 1) texts.push({ node: n, parent: n.parentElement, rect })
    }
    const contentBox = (el: Element) =>
      union([...texts.filter((t) => el.contains(t.parent)).map((t) => t.rect), ...[...el.querySelectorAll('svg,img')].filter(visible).map((i) => i.getBoundingClientRect())])

    // Payload's own size: switch off our unlayered 48px declarations (Payload's CSS sits in @layer), measure, restore.
    const ours: { style: CSSStyleDeclaration; prop: string; value: string; priority: string }[] = []
    const collectOurs = (rules: CSSRuleList) => {
      for (const rule of rules) {
        if (rule instanceof CSSLayerBlockRule) continue
        if (rule instanceof CSSStyleRule)
          for (const prop of [...rule.style])
            if ((/^min-(block|inline)-size$|^min-(width|height)$/.test(prop) && rule.style.getPropertyValue(prop).trim() === '48px') || /^--btn-padding-block/.test(prop))
              ours.push({ style: rule.style, prop, value: rule.style.getPropertyValue(prop), priority: rule.style.getPropertyPriority(prop) })
        if (rule instanceof CSSMediaRule || rule instanceof CSSSupportsRule) collectOurs(rule.cssRules)
      }
    }
    for (const sheet of document.styleSheets)
      try {
        collectOurs(sheet.cssRules)
      } catch {
        // Cross-origin sheet: not ours.
      }
    // Containers (a toolbar, a card, the page) grow with the controls inside them; judge the controls themselves.
    const paintedEls = [...document.body.querySelectorAll('*')].filter(
      (el) => visible(el) && (paintsAtRest(el) || paintsOnHover(el)) && !el.matches(MAY_GROW) && (el.matches(SEL) || !el.querySelector(SEL)),
    )
    for (const o of ours) o.style.removeProperty(o.prop)
    const own = paintedEls.map((el) => el.getBoundingClientRect())
    for (const o of ours) o.style.setProperty(o.prop, o.value, o.priority)
    paintedEls.forEach((el, i) => {
      const r = el.getBoundingClientRect(), p = own[i]!
      if (r.width - p.width > 2 || r.height - p.height > 2)
        out.push(`enlarged-visible-hit-area: ${name(el)} paints ${Math.round(r.width)}×${Math.round(r.height)}, Payload's own is ${Math.round(p.width)}×${Math.round(p.height)}`)
    })

    // Popups, drawers, menus, toasts and sticky bars float above the page on purpose: compare boxes within one layer.
    const layers = new Map<Element, Element>()
    const layer = (el: Element): Element => {
      if (layers.has(el)) return layers.get(el)!
      const own = el.matches('.popup__content,.drawer,.rs__menu,.Toastify,.toast,[role=dialog],dialog,.nav,nextjs-portal') || /sticky|fixed/.test(getComputedStyle(el).position)
      const l = own || !el.parentElement ? el : layer(el.parentElement)
      layers.set(el, l)
      return l
    }
    const meets = (a: DOMRect, b: DOMRect) => Math.min(a.right, b.right) - Math.max(a.left, b.left) > 2 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 2

    // Payload lays a transparent full-size control over dashboard cards and collapsible headers on purpose.
    const controls = [...document.querySelectorAll(SEL)].filter((el) => visible(el) && !el.matches('.card__click,.collapsible__toggle'))
    const boxes = new Map<Element, DOMRect>()
    const painted = new Set<Element>()
    for (const el of controls) {
      // Text fields are boxes by nature; other controls show their painted box, or else just their icon/label.
      const field = el.matches('input,select,textarea')
      if (paintsAtRest(el) || paintsOnHover(el)) painted.add(el)
      const box = painted.has(el) || field ? el.getBoundingClientRect() : contentBox(el)
      if (box) boxes.set(el, box)
    }

    const items = [...boxes]
    for (let i = 0; i < items.length; i++)
      for (let j = i + 1; j < items.length; j++) {
        const [a, ra] = items[i]!, [b, rb] = items[j]!
        if (a.contains(b) || b.contains(a) || layer(a) !== layer(b)) continue
        // A label and the (visually hidden) input it wraps are one control.
        if ([...((a as HTMLInputElement).labels ?? []), ...((b as HTMLInputElement).labels ?? [])].some((l) => l.contains(a) || l.contains(b))) continue
        if (meets(ra, rb)) out.push(`overlap: ${name(a)} and ${name(b)}`)
      }
    // Visible labels/text under a painted control they do not belong to.
    for (const el of painted) {
      const box = boxes.get(el)!
      for (const t of texts)
        if (!el.contains(t.parent) && !t.parent.contains(el) && layer(t.parent) === layer(el) && meets(box, t.rect))
          out.push(`overlap: ${name(el)} covers text "${t.node.textContent!.trim().slice(0, 24)}"`)
    }
    // Every point of a control's tap area (its box, grown by an invisible ::after) must reach the control.
    // react-select's text input is a 2px caret inside its 48px control.
    for (const el of controls.filter((c) => !c.matches('.rs__input'))) {
      const h = hitBox(el)
      // Partly scrolled out of a scrolling row (Payload's doc controls on a phone): the editor scrolls it in first.
      const r = el.getBoundingClientRect()
      let scroller = el.parentElement
      while (scroller && !/auto|scroll/.test(getComputedStyle(scroller).overflowX + getComputedStyle(scroller).overflowY)) scroller = scroller.parentElement
      const port = scroller?.getBoundingClientRect()
      if (port && scroller !== document.documentElement && (r.left < port.left || r.right > port.right || r.top < port.top || r.bottom > port.bottom)) continue
      if (h.left < 0 || h.top < 0 || h.right > innerWidth || h.bottom > innerHeight) continue
      const cx = h.left + h.width / 2, cy = h.top + h.height / 2
      // Centre and the middle of each edge: corners of a rounded control are not part of it.
      const points = [[cx, cy], [cx, h.top + 4], [cx, h.bottom - 4], [h.left + 4, cy], [h.right - 4, cy]]
      for (const [x, y] of points) {
        const top = document.elementFromPoint(x!, y!)
        if (!top || el.contains(top) || (top instanceof HTMLLabelElement && top.contains(el)) || layer(top) !== layer(el)) continue
        out.push(`tap-area: ${name(el)} at ${Math.round(x! - h.left)},${Math.round(y! - h.top)} of its ${Math.round(h.width)}×${Math.round(h.height)} area goes to ${top.contains(el) ? 'its container' : name(top)}`)
        break
      }
    }
    return [...new Set(out)]
  })
}

