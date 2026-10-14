// One JSON per page/feature keeps parallel work conflict-free; add new namespaces here.
import common from './common.json'
import gallery from './gallery.json'
import home from './home.json'
import projects from './projects.json'

const messages = { ...common, ...gallery, ...home, ...projects }
export default messages
