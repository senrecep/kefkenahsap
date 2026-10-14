// One JSON per page/feature keeps parallel work conflict-free; add new namespaces here.
import common from './common.json'
import gallery from './gallery.json'

const messages = { ...common, ...gallery }
export default messages
