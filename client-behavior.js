(function(document, window) {
    'use strict';
    //Define client status var
    var clientStatus = {};
    var statusPollTimeout = null;

    //Init document.Graphene object
    document.Graphene = !!document.Graphene ? document.Graphene : {};

    document.Graphene.clientBehavior = {
        created: function() {

        },

        ready: function() {
            this.set('_settings', window.graphene.settings);
            window.addEventListener('--graphene-settings-update', this._onSettingsUpdate.bind(this));
            window.addEventListener('--graphene-status-update', this._onStatusUpdate.bind(this));
            this._loadStorage();
        },

        attached: function() {
            this._onStatusUpdate();
            this._onSettingsUpdate();
        },

        logout: function() {
            return this.fetch('/auth/logout/' + this._accessToken)
        },

        fetch: function(query, data, method, headers, cacheResponse) {
            return new Promise(function(resolve, reject) {
                var reqSettings = {
                    method:  !!method ? method : !!data ? 'POST' : 'GET',
                    body:    !!data ? JSON.stringify(data) : undefined,
                    headers: {
                        'Accept':       'application/json',
                        'Content-Type': 'application/json',
                        'api-key':      this._settings.server.apiKey,
                        'access-token': this._accessToken
                    }
                };
                if (!!headers) {
                    for (var hk in headers) {
                        reqSettings.headers[hk] = headers[hk];
                    }
                }
                var url = query.indexOf('http://') === 0 || query.indexOf('https://') === 0 ? query : (this._settings.server.url + query);
                var cacheId = url + ' ' + reqSettings.method;
                if (!!this._settings.enableCache && cacheResponse && !!this._cache[cacheId]) {
                    resolve(this._cache[cacheId]);
                } else {
                    window.fetch(url, reqSettings)
                        .then(this._toJson.bind(this))
                        .catch(reject)
                        .then(this._checkErrors.bind(this))
                        .catch(reject)
                        .then(this._checkRules.bind(this, cacheResponse, query, cacheId))
                        .then(resolve);
                }
            }.bind(this));
        },

        _autofetch: function(query, data, method, headers, cacheResponse, auto) {
            if (auto && !!query) {
                this.fetch(query, data.base, method, headers.base, cacheResponse);
            }
        },

        go: function() {
            this._autofetch(this.query, this.data, this.method, this.headers, this.cacheResponse, true);
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
                this.set('_accessToken', jsonResponse.Session.accessToken);
                this._updateStorage();
                loadStatus();
            } else if (query.indexOf('/auth/logout') === 0) {
                this.set('_accessToken', '');
                this._updateStorage();
                loadStatus();
            }
            if (cacheResponse) {
                this._cache[cacheId] = jsonResponse;
                this._updateStorage();
            }
            return jsonResponse;
        },

        _updateStorage: function() {
            var storageData = {
                accessToken: this._accessToken,
                cache:       this._cache
            };
            window.localStorage.setItem(this._settings.appName + ' [graphene]', JSON.stringify(storageData));
            var event = new CustomEvent('--graphene-settings-update', {type: 'storageUpdate', data: storageData});
            window.dispatchEvent(event);
        },

        _loadStorage: function() {
            var data = JSON.parse(window.localStorage.getItem(this._settings.appName + ' [graphene]')) || this.dataProto;
            this.set('_accessToken', data.accessToken);
            this.set('_cache', data.cache);
        },

        _onSettingsUpdate: function() {
            this._loadStorage();
            this.fire('settings-update');
        },

        _onStatusUpdate: function() {
            this.set('status', clientStatus);
            this.set('statusLabel', clientStatus.statusLabel);
            this.fire('status-update');
        },

        dataProto: {
            accessToken: '',
            cache:       {}
        },

        observers: [
            '_autofetch(query, data.*, method, headers.*, cacheResponse, auto)'
        ],

        properties: {
            //Element settings
            query:         String,
            data:          Object,
            method:        String,
            headers:       Object,
            cacheResponse: Boolean,
            auto:          Boolean,

            //Settings
            _settings:     Object,
            _accessToken:  String,
            _ignoreUpdate: Boolean,
            _cache:        Object,

            //Element response
            ok:          {type: Boolean, notify: true},
            response:    {type: Object, notify: true},
            status:      {type: Object, notify: true},
            statusLabel: {type: String, notify: true},
        }
    };

    var loadStatus = function() {
        window.clearTimeout(statusPollTimeout);
        var settings = window.graphene.settings;
        var data = JSON.parse(window.localStorage.getItem(settings.appName + ' [graphene]')) || {};
        window.fetch(settings.server.url + '/system/client', {
                headers: {
                    'Accept':       'application/json',
                    'Content-Type': 'application/json',
                    'api-key':      settings.server.apiKey,
                    'access-token': data.accessToken || ''
                }
            })
            .then(function(httpResponse) {
                return httpResponse.json();
            })
            .then(function(json) {
                scheduleStatusPoll();
                clientStatus = json.ClientInfo;
                var event = new CustomEvent('--graphene-status-update', clientStatus);
                window.dispatchEvent(event);
            })
    };

    var scheduleStatusPoll = function() {
        statusPollTimeout = window.setTimeout(loadStatus, window.graphene.settings.server.spi);
    };

    loadStatus();

})(document, window);
