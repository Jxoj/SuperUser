// ==UserScript==
// @name         YouTube Ad Blocker
// @namespace    http://tampermonkey.net/
// @version      3.0
// @description  Block YouTube ads effectively
// @author       Patrick
// @match        https://*.youtube.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=youtube.com
// @grant        none
// @run-at       document-start
// @downloadURL https://update.greasyfork.org/scripts/526852/YouTube%20Ad%20Blocker.user.js
// @updateURL https://update.greasyfork.org/scripts/526852/YouTube%20Ad%20Blocker.meta.js
// ==/UserScript==

(function() {
    'use strict';

    // Safe ytInitialPlayerResponse patch
    try {
        var ytInitialPlayerResponse = null;
        function getter() {
            return ytInitialPlayerResponse;
        }
        function setter(data) {
            if (!data || typeof data !== 'object') {
                ytInitialPlayerResponse = data;
                return;
            }
            try {
                ytInitialPlayerResponse = { ...data, adPlacements: [], playerAds: [] };
            } catch (_) {
                ytInitialPlayerResponse = data;
            }
        }

        if (window.ytInitialPlayerResponse) {
            try {
                window.ytInitialPlayerResponse.adPlacements = [];
                window.ytInitialPlayerResponse.playerAds = [];
            } catch (_) {}
        } else {
            Object.defineProperty(window, 'ytInitialPlayerResponse', {
                get: getter,
                set: setter,
                configurable: true
            });
        }
    } catch (_) {}

    // Non-destructive FETCH interceptor for YouTube InnerTube player response
    try {
        const origFetch = window.fetch;
        if (typeof origFetch === 'function') {
            window.fetch = async function(...args) {
                const response = await origFetch.apply(this, args);
                try {
                    const reqUrl = (args[0] && typeof args[0] === 'string') ? args[0] : (args[0]?.url || response?.url || '');
                    if (reqUrl.includes('/youtubei/v1/player')) {
                        const origJson = response.json.bind(response);
                        response.json = async function() {
                            const data = await origJson();
                            if (data && typeof data === 'object') {
                                data.adPlacements = [];
                                data.playerAds = [];
                                delete data.adSlots;
                            }
                            return data;
                        };
                    }
                } catch (_) {}
                return response;
            };
        }
    } catch (_) {}

    // OTHER STUFF - just in case an ad gets through
    (function() {
        window.autoClick = setInterval(function() {
            try {
                const btn = document.querySelector('.videoAdUiSkipButton,.ytp-ad-skip-button');
                if (btn) {
                    btn.click();
                }
                const ad = document.querySelector('.ad-showing');
                if (ad) {
                    document.querySelector('video').playbackRate = 10;
                }
            } catch (ex) {}
        }, 100);

        window.inlineAdsInterval = setInterval(function() {
            try {
                const div = document.querySelector('#player-ads');
                if (div) {
                    div.parentNode.removeChild(div);
                }
            } catch (ex) {}
        }, 500);
    })();
})();