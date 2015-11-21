/* globals Components, APP_SHUTDOWN */
const { utils: Cu } = Components;

/* globals XPCOMUtils, Preferences, Services */
Cu.import('resource://gre/modules/XPCOMUtils.jsm');
XPCOMUtils.defineLazyModuleGetter(this, 'Preferences', 'resource://gre/modules/Preferences.jsm');
XPCOMUtils.defineLazyModuleGetter(this, 'Services', 'resource://gre/modules/Services.jsm');

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
	// Work around bug 1051238.
	_frameScriptURL: 'chrome://betterreader/content/frame.js?' + Math.random(),
	_processmessages: [
		'BetterReader:setPref'
	],
	init: function() {
		for (let m of this._processmessages) {
			Services.ppmm.addMessageListener(m, this);
		}
		Services.mm.loadFrameScript(this._frameScriptURL, true);
	},
	destroy: function() {
		Services.mm.removeDelayedFrameScript(this._frameScriptURL, true);
		Services.mm.broadcastAsyncMessage('BetterReader:disable');
		for (let m of this._processmessages) {
			Services.ppmm.removeMessageListener(m, this);
		}
	},
	receiveMessage: function(message) {
		switch (message.name) {
		case 'BetterReader:setPref':
			Preferences.set('extensions.betterreader.' + message.data.name, message.data.value);
			break;
		}
	}
};
