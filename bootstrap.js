/* globals Components, APP_SHUTDOWN */
const { classes: Cc, interfaces: Ci, utils: Cu } = Components;

/* globals XPCOMUtils, Preferences */
Cu.import('resource://gre/modules/XPCOMUtils.jsm');
XPCOMUtils.defineLazyModuleGetter(this, 'Preferences', 'resource://gre/modules/Preferences.jsm');

let messageManager;
let messageListener;

/* exported install, uninstall, startup, shutdown */
function install() {
}
function uninstall() {
}
function startup() {
	messageListener.init();
}
function shutdown(params, reason) {
	if (reason == APP_SHUTDOWN) {
		return;
	}
	messageListener.destroy();
}

messageListener = {
	_messages: [
		'BetterReader:getPrefs',
		'BetterReader:setPref'
	],
	init: function() {
		messageManager = Cc['@mozilla.org/globalmessagemanager;1'].getService(Ci.nsIMessageListenerManager);
		for (let m of this._messages) {
			messageManager.addMessageListener(m, this);
		}
		messageManager.loadFrameScript('chrome://betterreader/content/frame.js', true);
	},
	destroy: function() {
		messageManager.removeDelayedFrameScript('chrome://betterreader/content/frame.js', true);
		messageManager.broadcastAsyncMessage('BetterReader:disable');
		for (let m of this._messages) {
			messageManager.removeMessageListener(m, this);
		}
	},
	receiveMessage: function(message) {
		switch (message.name) {
		case 'BetterReader:getPrefs':
			let prefs = Object.create(null);
			let send = false;
			for (let k of ['font', 'width', 'css.foreground', 'css.borders', 'css.background', 'css.button-hover']) {
				if (Preferences.has('extensions.betterreader.' + k)) {
					send = true;
					prefs[k] = Preferences.get('extensions.betterreader.' + k);
				}
			}
			if (send) {
				message.target.messageManager.sendAsyncMessage('BetterReader:prefs', prefs);
			}
			break;
		case 'BetterReader:setPref':
			Preferences.set('extensions.betterreader.' + message.data.key, message.data.value);
			break;
		}
	}
};
