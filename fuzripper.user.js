// ==UserScript==
// @name        Comic FUZ Image Ripper
// @namespace   fuzripper
// @version     2.2
// @icon        https://comic-fuz.com/favicons/favicon.ico
// @description Rips the images from the Comic FUZ website. (based on ebjhooker)
// @author      Youko
// @updateURL   https://github.com/InfiniteFeatures/FUZ-Image-Ripper/raw/master/fuzripper.user.js
// @downloadURL https://github.com/InfiniteFeatures/FUZ-Image-Ripper/raw/master/fuzripper.user.js
// @run-at		  document-start
// @include     https://comic-fuz.com/*/viewer/*
// @grant       GM_xmlhttpRequest
// ==/UserScript==

// Borrows code from eligrey (https://github.com/eligrey/) that's been embedded and changed to fit the needs of the script

// Here's some usage tips
// 1. If you pressed cancel at the prompt or if it didn't show at all, press the 'up' key on your keyboard to turn on autoripping.
// 2. Autoripping won't stop until it gets to the end or if you make it save the same pages twice.
// 3. You can just manually rip using the left arrow key to scroll. You can also use the down arrow key to save the current loaded pages.
// 4. If you want to start ripping at a certain spot, just use any method to get through the book that isn't the left arrow key and it won't rip anything.
(function() {
    let downloadedPages = [];
    let activeDownloads = 0;
    let autoSave = false;
    let bookname;

    let pad = function(n, width, z) {
        z = z || '0';
        n = n + '';
        return n.length >= width ? n : new Array(width - n.length + 1).join(z) + n;
    };

    function triggerKey(){
        try{
            let keyEvent = new KeyboardEvent("keydown", {"key": "ArrowLeft"});
            if (window) window.dispatchEvent(keyEvent);
        }
        catch(e){
            console.log(e);
        }
    }

    function fullWidthNumConvert(fullWidthNum) {
        return fullWidthNum.replace(/[\uFF10-\uFF19]/g, function(m) {
          return String.fromCharCode(m.charCodeAt(0) - 0xfee0);
        });
    }

    function savePage(page) {
        let number = page.alt.split("_")[1];
        let filename = bookname + " " + pad(parseInt(number) + 1, 4) + '.jpg';
        saveAs(page.src, filename);
    }

    function pageChange(observer, page) {
        savePage(page);
        activeDownloads--;
        observer.disconnect()
        if (autoSave && activeDownloads === 0) {
            triggerKey();
        }
    }

    function doSave(force) {
        let pages = document.querySelectorAll('img[alt^=page]');
        let end = true;
        for (let i = 0; i < pages.length; i++) {
            let page = pages[i];
            let pagenumber = page.alt.split("_")[1];

            if (downloadedPages.includes(pagenumber) && !force) {
                continue;
            } else {
                end = false;
                if (!bookname) {
                    bookname = fullWidthNumConvert(document.querySelector('p[class^=ViewerHeader]').innerText);
                }
                if (page.src) {
                    savePage(page);
                } else {
                    let observer = new MutationObserver((changes) => {
                        pageChange(observer, changes[0].target)
                    });
                    observer.observe(page, {attributes : true, attributeFilter: ["src"]});
                    activeDownloads++;
                }
                downloadedPages.push(pagenumber);
            }
        }
        if (autoSave) {
            if (end) {
                alert("Saving done.");
                autoSave = false;
            } else if (activeDownloads === 0) {
                triggerKey();
            }
        }
    }

    // wait for page to load
    function domReady(){
        if (confirm("Dump automatically? (Press the up arrow key to turn it on later, or use the left arrow key to rip manually)")) {
            autoSave = true;
            setTimeout(triggerKey, 500);
        }
        window.addEventListener('keydown', function(e) {
            if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
                doSave(e.key === "ArrowDown")
            } else if (e.key === "ArrowUp") {
                autoSave = true;
                setTimeout(triggerKey, 500);
            }
        });
    }

    // Mozilla, Opera, Webkit
    if (document.addEventListener) {
        document.addEventListener("DOMContentLoaded", function el(){
            document.removeEventListener("DOMContentLoaded", el, false);
            domReady();
        }, false);
    }

    let saveAs = (function(view) {
        "use strict";
        // IE <10 is explicitly unsupported
        if (typeof view === "undefined" || typeof navigator !== "undefined" && /MSIE [1-9]\./.test(navigator.userAgent)) {
            return;
        }
        let doc = view.document;

        let save_link = doc.createElementNS("http://www.w3.org/1999/xhtml", "a");
        let can_use_save_link = "download" in save_link;

        let click = function(node) {
            let event = new MouseEvent("click");
            node.dispatchEvent(event);
        };

        let is_safari = /constructor/i.test(view.HTMLElement) || view.safari;
        let is_chrome_ios =/CriOS\/[\d]+/.test(navigator.userAgent);
        let setImmediate = view.setImmediate || view.setTimeout;

        let throw_outside = function(ex) {
            setImmediate(function() {
                throw ex;
            }, 0);
        };

        let dispatch = function(filesaver, event_types, event) {
            event_types = [].concat(event_types);
            let i = event_types.length;
            while (i--) {
                let listener = filesaver["on" + event_types[i]];
                if (typeof listener === "function") {
                    try {
                        listener.call(filesaver, event || filesaver);
                    } catch (ex) {
                        throw_outside(ex);
                    }
                }
            }
        };
        
        class FileSaver {
            constructor(object_url, name) {
                // First try a.download, then web filesystem, then object URLs
                let filesaver = this;

                let dispatch_all = function() {
                    dispatch(filesaver, "writestart progress write writeend".split(" "));
                };

                // on any filesys errors revert to saving with object URLs
                let fs_error = async function() {
                    if ((is_chrome_ios || is_safari) && view.FileReader) {
                        // Safari doesn't allow downloading of blob urls
                        let reader = new FileReader();
                        async function get(url) {
                            let response = await fetch(url);
                            let data = await response.blob();
                            return data;
                        }
                        let res;
                        try {
                            res = await get(object_url);
                        } catch (e) {
                            return;
                        }
                        reader.onloadend = function () {
                            let url = is_chrome_ios ? reader.result : reader.result.replace(/^data:[^;]*;/, 'data:attachment/file;');
                            let popup = view.open(url, '_blank');
                            if (!popup) {
                                view.location.href = url;
                            }
                            url = undefined; // release reference before dispatching
                            filesaver.readyState = filesaver.DONE;
                            dispatch_all();
                        };
                        reader.readAsDataURL(res);
                        filesaver.readyState = filesaver.INIT;
                        return;
                    }
                    let opened = view.open(object_url, "_blank");
                    if (!opened) {
                        // Apple does not allow window.open, see https://developer.apple.com/library/safari/documentation/Tools/Conceptual/SafariExtensionGuide/WorkingwithWindowsandTabs/WorkingwithWindowsandTabs.html
                        view.location.href = object_url;
                    }
                    filesaver.readyState = filesaver.DONE;
                    dispatch_all();
                };
                filesaver.readyState = filesaver.INIT;

                if (can_use_save_link) {
                    setImmediate(function() {
                        save_link.href = object_url;
                        save_link.download = name;
                        click(save_link);
                        dispatch_all();
                        filesaver.readyState = filesaver.DONE;
                    }, 0);
                    return;
                }

                fs_error();
            }
        }

        let FS_proto = FileSaver.prototype;

        let saveAs = function(object_url, name) {
            return new FileSaver(object_url, name || "download");
        };

        FS_proto.abort = function(){};
        FS_proto.readyState = FS_proto.INIT = 0;
        FS_proto.WRITING = 1;
        FS_proto.DONE = 2;

        FS_proto.error =
            FS_proto.onwritestart =
                FS_proto.onprogress =
                    FS_proto.onwrite =
                        FS_proto.onabort =
                            FS_proto.onerror =
                                FS_proto.onwriteend =
                                    null;

        return saveAs;
    }(
        typeof self !== "undefined" && self
        || typeof window !== "undefined" && window
        || this
    ));
})();
