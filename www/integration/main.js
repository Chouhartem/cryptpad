define([
    '/common/sframe-common-outer.js',
    '/common/common-hash.js',
    '/common/cryptget.js',
    '/bower_components/nthen/index.js',
], function (SCO, Hash, Crypt, nThen) {

    var getTxid = function () {
        return Math.random().toString(16).replace('0.', '');
    };
    var init = function () {
        console.warn('INIT');
        var p = window.parent;
        var txid = getTxid();
        p.postMessage(JSON.stringify({ q: 'INTEGRATION_READY', txid: txid }), '*');

        var makeChan = function () {
            var handlers = {};
            var commands = {};

            var _sendCb = function (txid, args) {
                p.postMessage({ ack: txid, args: args}, '*');
            };
            var onMsg = function (ev) {
                if (ev.source !== p) { return; }
                var data = ev.data;

                // On ack
                if (data.ack) {
                    if (handlers[data.ack]) {
                        handlers[data.ack](data.args);
                        delete handlers[data.ack];
                    }
                    return;
                }

                // On new command
                var msg = data.msg;
                var txid = data.txid;
                if (commands[msg.q]) {
                    commands[msg.q](msg.data, function (args) {
                        _sendCb(txid, args);
                    });
                    return;
                }

            };
            window.addEventListener('message', onMsg);

            var send = function (q, data, cb) {
                var txid = getTxid();
                if (cb) { handlers[txid] = cb; }
                p.postMessage({ msg: {
                    q: q,
                    data: data,
                }, txid: txid}, '*');
                setTimeout(function () {
                    delete handlers[txid];
                }, 60000);
            };
            var on = function (q, handler) {
                if (typeof(handler) !== "function") { return; }
                commands[q] = handler;
            };

            return {
                send: send,
                on: on
            };
        };
        var chan = makeChan();

        var isNew = false;
        // Make a HEAD request to the servre to check if a file exists in datastore
        // XXX update nginx config
        var checkSession = function (oldKey, cb) {
            var channel = Hash.hrefToHexChannelId(Hash.hashToHref(oldKey));
            var prefix = channel.slice(0,2);
            var url = `/datastore/${prefix}/${channel}.ndjson`;

            var http = new XMLHttpRequest();
            http.open('HEAD', url);
            http.onreadystatechange = function() {
                if (this.readyState === this.DONE) {
                    console.error(this.status);
                    if (this.status === 200) {
                        return cb({state: true});
                    }
                    if (this.status === 404) {
                        return cb({state: false});
                    }
                    cb({error: 'Internal server error'});
                }
            };
            http.send();
        };
        chan.on('GET_SESSION', function (data, cb) {
            var getHash = function () {
                isNew = true;
                return Hash.createRandomHash('integration');
            };
            var oldKey = data.sessionKey;
            if (!oldKey) { return void cb({ key: getHash() }); }

            checkSession(oldKey, function (obj) {
                if (!obj || obj.error) { return cb(obj); }
                cb({
                    key: obj.state ? oldKey : getHash()
                });
            });
        });

        chan.on('START', function (data) {
            console.warn('INNER START', data);
            nThen(function (w) {
                if (!isNew) { return; }

                // XXX initial content TBD
                var content = JSON.stringify({
                    content: data.document,
                    highlightMode: "gfm"
                }); // XXX only for code

                console.error('CRYPTPUT', data.sessionKey);
                Crypt.put(data.sessionKey, content, w(), {
                    metadata: {
                        selfdestruct: true
                    }
                });
            }).nThen(function () {
                var href = Hash.hashToHref(data.sessionKey, data.application);
                console.error(Hash.hrefToHexChannelId(href));
                window.CP_integration_outer = {
                    pathname: `/${data.application}/`,
                    hash: data.sessionKey,
                    href: href
                };
                require(['/common/sframe-app-outer.js'], function () {
                    console.warn('SAO REQUIRED');
                    delete window.CP_integration_outer;
                });
            });
        });

    };
    init();
    /*
    nThen(function (waitFor) {
    }).nThen(function () {
    });
    */

});
