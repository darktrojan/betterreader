/* globals Components, APP_SHUTDOWN */
const { utils: Cu } = Components;
const XULNS = 'http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul';

/* globals XPCOMUtils, Preferences, Services */
Cu.import('resource://gre/modules/XPCOMUtils.jsm');
XPCOMUtils.defineLazyModuleGetter(this, 'Preferences', 'resource://gre/modules/Preferences.jsm');
XPCOMUtils.defineLazyModuleGetter(this, 'Services', 'resource://gre/modules/Services.jsm');

/* globals strings */
XPCOMUtils.defineLazyGetter(this, 'strings', function() {
	return Services.strings.createBundle('chrome://betterreader/locale/strings.properties');
});

/* exported install, uninstall, startup, shutdown */
function install() {
}
function uninstall() {
}
function startup() {
	messageListener.init();
	windowObserver.init();
}
function shutdown(params, reason) {
	if (reason == APP_SHUTDOWN) {
		return;
	}
	messageListener.destroy();
	windowObserver.destroy();
}

var messageListener = {
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

var windowObserver = {
	init: function() {
		this.enumerate(this.paint);
		Services.ww.registerNotification(this);
	},
	destroy: function() {
		this.enumerate(this.unpaint);
		Services.ww.unregisterNotification(this);
	},
	enumerate: function(callback) {
		let windowEnum = Services.wm.getEnumerator('navigator:browser');
		while (windowEnum.hasMoreElements()) {
			callback.call(this, windowEnum.getNext());
		}
	},
	observe: function(subject) {
		subject.addEventListener('load', function() {
			windowObserver.paint(subject);
		}, false);
	},
	paint: function(win) {
		if (win.location == 'chrome://browser/content/browser.xul') {
			let doc = win.document;
			let menu = doc.getElementById('contentAreaContextMenu');
			menu.addEventListener('popupshowing', this.onPopupShowing);
			let before = doc.getElementById('context-openlinkprivate').nextElementSibling;

			let menuitem = doc.createElementNS(XULNS, 'menuitem');
			menuitem.id = 'betterreader-openinreader';
			menuitem.setAttribute('label', strings.GetStringFromName('context.openinreader.label'));
			menuitem.addEventListener('command', this.onMenuItemClicked);
			menu.insertBefore(menuitem, before);
		}
	},
	unpaint: function(win) {
		if (win.location == 'chrome://browser/content/browser.xul') {
			let doc = win.document;
			let menu = doc.getElementById('contentAreaContextMenu');
			menu.removeEventListener('popupshowing', this.onPopupShowing);
			doc.getElementById('betterreader-openinreader').remove();
		}
	},
	onPopupShowing: function(event) {
		let doc = event.view.document;
		let win = doc.defaultView;

		doc.getElementById('betterreader-openinreader').hidden = !win.gContextMenu.onLink;
	},
	onMenuItemClicked: function(event) {
		let doc = event.view.document;
		let win = doc.defaultView;

		win.urlSecurityCheck(win.gContextMenu.linkURL, win.gContextMenu.principal);
		win.openLinkIn(
			'about:reader?url=' + encodeURIComponent(win.gContextMenu.linkURL),
			'current', win.gContextMenu._openLinkInParameters()
		);
	}
};
