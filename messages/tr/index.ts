// One JSON per page/feature keeps parallel work conflict-free; add new namespaces here.
import category from './category.json'
import common from './common.json'
import consent from './consent.json'
import contact from './contact.json'
import gallery from './gallery.json'
import home from './home.json'
import pages from './pages.json'
import projects from './projects.json'

const messages = { ...common, ...consent, ...contact, ...gallery, ...home, ...pages, ...projects, ...category }
export default messages
