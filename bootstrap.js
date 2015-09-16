/* globals APP_SHUTDOWN */
/* exported install, uninstall, startup, shutdown */

const { classes: Cc, interfaces: Ci } = Components;

let messageManager = Cc["@mozilla.org/globalmessagemanager;1"].getService(Ci.nsIMessageListenerManager);

function install() {
}
function uninstall() {
}
function startup() {
	messageManager.loadFrameScript("chrome://betterreader/content/frame.js", true);
}
function shutdown(params, reason) {
	if (reason == APP_SHUTDOWN) {
		return;
	}

	messageManager.removeDelayedFrameScript("chrome://betterreader/content/frame.js", true);
	messageManager.broadcastAsyncMessage("BetterReader:disable");
}
