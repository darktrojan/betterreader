/* globals Components, APP_STARTUP, APP_SHUTDOWN, ADDON_INSTALL */
const { utils: Cu } = Components;
const XULNS = 'http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul';

/* globals XPCOMUtils, Preferences, Services */
Cu.import('resource://gre/modules/XPCOMUtils.jsm');
XPCOMUtils.defineLazyModuleGetter(this, 'Preferences', 'resource://gre/modules/Preferences.jsm');
XPCOMUtils.defineLazyModuleGetter(this, 'Services', 'resource://gre/modules/Services.jsm');

/* globals idleService */
XPCOMUtils.defineLazyServiceGetter(this, 'idleService', '@mozilla.org/widget/idleservice;1', 'nsIIdleService');

/* globals strings */
XPCOMUtils.defineLazyGetter(this, 'strings', function() {
	return Services.strings.createBundle(
		// Work around bug 918033.
		'chrome://betterreader/locale/strings.properties?' + Math.random()
	);
});

var prefs = Services.prefs.getBranch('extensions.betterreader.');
var idleTimeout = 20;

/* exported install, uninstall, startup, shutdown */
function install() {
}
function uninstall() {
}
function startup(params, reason) {
	if (reason == APP_STARTUP) {
		Services.obs.addObserver({
			observe: function() {
				Services.obs.removeObserver(this, 'browser-delayed-startup-finished');
				realStartup(params, reason);
			}
		}, 'browser-delayed-startup-finished', false);
	} else {
		realStartup(params, reason);
	}
}
function realStartup(params, reason) {
	let defaultPrefs = Services.prefs.getDefaultBranch('extensions.betterreader.');
	defaultPrefs.setIntPref('donationreminder', 0);
	defaultPrefs.setCharPref('version', 0);

	messageListener.init();
	windowObserver.init();

	// Truncate version numbers to floats
	let oldVersion = parseFloat(prefs.getCharPref('version'), 10);
	let currentVersion = parseFloat(params.version, 10);
	if (reason != ADDON_INSTALL && Services.vc.compare(oldVersion, currentVersion) == -1) {
		let lastReminder = prefs.getIntPref('donationreminder') * 1000;
		let shouldRemind = Date.now() - lastReminder > 604800000;

		if (shouldRemind) {
			idleService.addIdleObserver(idleObserver, idleTimeout);
		}
	}
	prefs.setCharPref('version', params.version);
}
function shutdown(params, reason) {
	if (reason == APP_SHUTDOWN) {
		return;
	}
	messageListener.destroy();
	windowObserver.destroy();

	try {
		idleService.removeIdleObserver(idleObserver, idleTimeout);
	} catch (e) { // might be already removed
	}
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
		Services.mm.broadcastAsyncMessage('BetterReader:enable');
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

		doc.getElementById('betterreader-openinreader').hidden = !win.gContextMenu.onSaveableLink;
	},
	onMenuItemClicked: function(event) {
		let doc = event.view.document;
		let win = doc.defaultView;

		win.urlSecurityCheck(win.gContextMenu.linkURL, win.gContextMenu.principal);
		win.openLinkIn(
			'about:reader?url=' + encodeURIComponent(win.gContextMenu.linkURL),
			event.ctrlKey ? 'tab' : 'current', win.gContextMenu._openLinkInParameters()
		);
	}
};

var idleObserver = {
	observe: function(service, state) {
		if (state != 'idle') {
			return;
		}
		idleService.removeIdleObserver(this, idleTimeout);

		let version = prefs.getCharPref('version');
		let recentWindow = Services.wm.getMostRecentWindow('navigator:browser');
		let notificationBox = recentWindow.document.getElementById('global-notificationbox');
		let message = strings.formatStringFromName('newversion', [parseFloat(version, 10)], 1);
		let changeLogLabel = strings.GetStringFromName('changelog.label');
		let changeLogAccessKey = strings.GetStringFromName('changelog.accesskey');
		let donateLabel = strings.GetStringFromName('donate.label');
		let donateAccessKey = strings.GetStringFromName('donate.accesskey');

		notificationBox.appendNotification(
			message, 'betterreader-donate', null,// 'chrome://betterreader/content/icon16.png',
			notificationBox.PRIORITY_INFO_MEDIUM, [{
				label: changeLogLabel,
				accessKey: changeLogAccessKey,
				callback: function() {
					recentWindow.switchToTabHavingURI(
						'https://addons.mozilla.org/addon/better-reader/versions/' + version, true
					);
				}
			}, {
				label: donateLabel,
				accessKey: donateAccessKey,
				callback: function() {
					recentWindow.switchToTabHavingURI(
						'https://darktrojan.github.io/donate.html?betterreader', true
					);
				}
			}]
		);

		prefs.setIntPref('donationreminder', Date.now() / 1000);
	}
};
