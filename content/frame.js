/* globals addEventListener, addMessageListener, removeEventListener, removeMessageListener, content */

addEventListener("AboutReaderContentLoaded", listener, false, true);

addMessageListener("BetterReader:disable", disableListener);

function listener() {
	if (!content || !isAboutReader()) {
		return;
	}

	let dropdown = content.document.getElementById("style-dropdown");
	let popup = content.document.getElementById("reader-popup");
	let before = content.document.getElementById("font-size-buttons");

	let div = content.document.createElement("div");
	div.id = "font-choice";

	let style = content.document.createElement("style");
	style.setAttribute("scoped", "");
	style.textContent = "@import url(\"chrome://betterreader/content/reader.css\");";
	div.appendChild(style);

	let select = content.document.createElement("select");
	let fontEnumerator = Components.classes["@mozilla.org/gfx/fontenumerator;1"]
		.createInstance(Components.interfaces.nsIFontEnumerator);
	for (let f of fontEnumerator.EnumerateAllFonts({})) {
		let option = content.document.createElement("option");
		option.textContent = f;
		select.appendChild(option);
	}
	select.onchange = function() {
		if (dropdown.classList.contains("open")) {
			let container = content.document.getElementById("container");
			container.style.fontFamily = this.value;
		}
	};
	div.appendChild(select);

	popup.insertBefore(div, before);
	popup.insertBefore(content.document.createElement("hr"), before);

	before = content.document.getElementById("color-scheme-buttons");

	div = content.document.createElement("div");
	div.id = "container-width-buttons";

	style = style.cloneNode(true);
	div.appendChild(style);

	let button = content.document.createElement("button");
	button.className = "narrower-button";
	button.onclick = function() {
		changeWidth(-5);
	};
	div.appendChild(button);

	button = content.document.createElement("button");
	button.className = "wider-button";
	button.onclick = function() {
		changeWidth(5);
	};
	div.appendChild(button);

	popup.insertBefore(div, before);
	popup.insertBefore(content.document.createElement("hr"), before);
}

function disableListener() {
	removeEventListener("AboutReaderContentLoaded", listener, false, true);
	removeMessageListener("BetterReader:disable", disableListener);
}

function isAboutReader() {
  if (!content) {
    return false;
  }
  return content.document.documentURI.startsWith("about:reader");
}

function changeWidth(change) {
	let container = content.document.getElementById("container");
	let style = content.getComputedStyle(container, null);
	let currentWidth = parseFloat(style.maxWidth, 10);
	let fontSize = parseFloat(style.fontSize, 10);
	let newWidth = (currentWidth / fontSize) + change;

	if (newWidth > 80 || newWidth < 20) {
		return;
	}

	container.style.maxWidth = newWidth + "em";
}
