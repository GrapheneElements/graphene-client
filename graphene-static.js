(function(window) {
    'use strict';

    window.Graphene = window.Graphene || {};

    window.Graphene.static = {
        statusPollTimeout: -1,
        accessToken:       null,
        cache:             {},
        loadingChange:     false,

        listeners: {},

        loadStatus: function() {
            window.clearTimeout(this.statusPollTimeout);
            window.fetch(window.Graphene.settings.server.url + '/system/client', {
                    headers: {
                        'Accept':       'application/json',
                        'Content-Type': 'application/json',
                        'api-key':      window.Graphene.settings.server.apiKey,
                        'access-token': this.accessToken || ''
                    }
                })
                .then(function(httpResponse) {
                    this.scheduleStatusPoll();
                    return httpResponse;
                }.bind(this))
                .catch(function(httpResponse) {
                    //Probabilmente il server risulta irraggiungibile
                    this.scheduleStatusPoll();
                    return httpResponse;
                }.bind(this))
                .then(function(httpResponse) {
                    return httpResponse.json();
                })
                .then(function(json) {
                    this.set('status', json.ClientInfo);
                }.bind(this))
        },

        scheduleStatusPoll: function() {
            this.statusPollTimeout = window.setTimeout(this.loadStatus.bind(this), window.Graphene.settings.server.spi);
        },

        loadData: function() {
            var data = JSON.parse(window.localStorage.getItem(window.Graphene.settings.appName + ' [graphene]')) || {};
            this.set('accessToken', data.accessToken || '', {ignoreStorage: true});
            this.set('cache', data.cache || {}, {ignoreStorage: true});
        },

        storeData: function() {
            var data = {
                cache:       this.cache,
                accessToken: this.accessToken
            };
            window.localStorage.setItem(window.Graphene.settings.appName + ' [graphene]', JSON.stringify(data));
        },

        addToCache: function(id, value) {
            id = md5(id);
            this.cache[id] = value;
            this.notify('cache', this.cache);
        },

        getFromCache: function(id) {
            id = md5(id);
            return this.cache[id] || null;
        },

        set: function(k, v, info) {
            var info = info || {};
            this[k] = v;
            this.notify(k, v, info);
        },

        notify: function(k, v, info) {
            info = info || {};
            if (!!this.listeners[k]) {
                for (var i in this.listeners[k]) {
                    this.listeners[k][i](v, info);
                }
            }
        },

        listen: function(k, callback) {
            this.listeners[k] = this.listeners[k] || [];
            callback.grapheneStaticListenerId = this.listeners[k].length;
            callback.grapheneStaticListenerType = k;
            this.listeners[k].push(callback);
        },

        unlisten: function(callback) {
            var type = callback.grapheneStaticListenerType;
            var id = callback.grapheneStaticListenerId;
            var delType = this.listeners[type][id].grapheneStaticListenerType;
            var delId = this.listeners[type][id].grapheneStaticListenerId;
            if (type === delType && id === delId) {
                this.listeners[type][id] = null;
            }
        }
    };

    window.Graphene.static.listen('accessToken', function(value, info) {
        window.Graphene.static.loadStatus();
        if (!(!!info.ignoreStorage)) {
            window.Graphene.static.storeData();
        }
    });

    window.Graphene.static.listen('cache', function(value, info) {
        if (!(!!info.ignoreStorage)) {
            window.Graphene.static.storeData();
        }
    });

    window.Graphene.static.loadData(); //Caricamento iniziale dei dati di storage

})(window);
