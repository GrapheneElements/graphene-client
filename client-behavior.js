(function(window) {
    'use strict';
    //Define client status var

    //Init document.Graphene object
    window.Graphene = window.Graphene || {};
    window.Graphene.behaviors = window.Graphene.behaviors || {};

    window.Graphene.behaviors.clientBehavior = {

        ready: function() {
            //this.set('_settings', window.graphene.settings);
            window.Graphene.static.listen('status', this._onStatusUpdate.bind(this));
        },

        attached: function() {
            this._setClientStatus(window.Graphene.static.status);
        },

        fetch: function(query, data, method, headers, cacheResponse) {
            return new Promise(function(resolve, reject) {
                var reqSettings = {
                    method:  !!method ? method : !!data ? 'POST' : 'GET',
                    body:    !!data ? JSON.stringify(data) : undefined,
                    headers: {
                        'Accept':       'application/json',
                        'Content-Type': 'application/json',
                        'api-key':      window.Graphene.settings.server.apiKey,
                        'access-token': window.Graphene.static.accessToken
                    }
                };
                if (!!headers) {
                    for (var hk in headers) {
                        reqSettings.headers[hk] = headers[hk];
                    }
                }
                var url = query.indexOf('http://') === 0 || query.indexOf('https://') === 0 ? query : (window.Graphene.settings.server.url + query);
                var cacheId = url + ' ' + reqSettings.method;
                if (!!window.Graphene.settings.enableCache && cacheResponse && !!window.Graphene.static.getFromCache(cacheId)) {
                    resolve(window.Graphene.static.getFromCache(cacheId));
                } else {
                    window.fetch(url, reqSettings)
                        .then(this._toJson.bind(this)).catch(reject)
                        .then(this._checkErrors.bind(this)).catch(reject)
                        .then(this._checkRules.bind(this, cacheResponse, query, cacheId))
                        .then(resolve);
                }
            }.bind(this));
        },

        _toJson: function(httpResponse) {
            return httpResponse.json();
        },

        _checkErrors: function(jsonResponse) {
            for (var rootItem in jsonResponse) {
                if (rootItem === 'error') {
                    this.set('error', jsonResponse['error']);
                    this.set('ok', false);
                    this.fire('error', this.error);
                    throw new Error(JSON.stringify(jsonResponse['error']));
                }
            }
            this.set('error', null);
            this.set('ok', true);
            return jsonResponse;
        },

        _checkRules: function(cacheResponse, query, cacheId, jsonResponse) {
            //Recupero informazioni da risposta
            if (query.indexOf('/auth/login') === 0) {
                window.Graphene.static.set('accessToken', jsonResponse.Session.accessToken);
            } else if (query.indexOf('/auth/logout') === 0) {
                window.Graphene.static.set('accessToken', '');
            }
            if (cacheResponse) {
                window.Graphene.static.addToCache(cacheId, jsonResponse);
            }
            return jsonResponse;
        },

        _onStatusUpdate: function(status) {
            this._setClientStatus(status);
            this.fire('client-status-update', status);
        },

        logout: function() {
            this.fetch('/auth/logout/' + window.Graphene.static.accessToken);
        },

        properties: {
            clientStatus: {type: Object, notify: true, readOnly: true}
        }
    };

})(window);
