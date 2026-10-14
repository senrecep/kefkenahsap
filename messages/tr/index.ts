// One JSON per page/feature keeps parallel work conflict-free; add new namespaces here.
import common from './common.json'
import projects from './projects.json'

const messages = { ...common, ...projects }
export default messages
