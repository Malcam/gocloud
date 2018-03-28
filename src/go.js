// JavaScript autoComplete v0.9.0
// https://github.com/

var Middleware = function() {};

Middleware.prototype.use = function(fn) {
    var self = this;

    this.stuff = (stack) => (data, next) => {
                            stack.call(self, data, function() {
                            fn.call(self, data, next.bind(self));
                        });
    }

    this.go = this.stuff(this.go);
   //this.go = (stack => (res,next) => stack( res, (data) => fn.bind(this, ( data || res) , next.bind(this)) ))(this.go);
};

Middleware.prototype.go = function(data, next) {
  next();
};

(function(w){

    function regexValidatorFn( pattern, data ) {
        return new RegExp(pattern, 'i').test(data);
    }

    function command(fn) {
        return (req, next)  => { fn(req); next(); };
    }

    var goFactory = {
        makeRouter: function () {
            return new router();
        },
        makeParser: function() {
            return new parser;
        },
        makeUrlAdapter: function (fn) {
            if( !fn ) {
                throw new Error("fn is not a function");
            }
            return { adapt: command(fn) }
        },
        makeValidator: function(fn = null) {
            return {validate: fn ? fn :regexValidatorFn }
        }
    }

/**
 * Router
 */
    var router = function () {
        this.hash = Math.random();
        this.handler  = new Middleware();
    }

    router.prototype = {
        match: function (regex, fn) {
            this.handler.use((data, next) =>  {
                this.validate(regex, data ? data.url : null) && fn(data, data.extras)
                next();
            })
        },
        validate:function(pattern, url) {
            return new RegExp(pattern, 'i').test(url);
        },
        listen: function () {
            var myfn = function(res, next) {
                this.handler.go(res, ()=>console.log("router "+ this.hash +" handling request"))
                next();
            }

            return myfn.bind(this);
        }
    }

    var parser = function() {
        this.hash = Math.random();
    }

    parser.prototype = {
        parse: function(req, next) {

            if( req.data == null) {
                next();
                return;
            }
            
            let dataWrapper = null;
            let data = req.data;
        
            if( typeof data === "object" ) {
                //dataWrapper = JSON.stringify({"data":data}) no soported yet
                dataWrapper = new FormData();
                for (i in data) {
                    dataWrapper.append(i, data[i])
                }
            }else if ( typeof data === "string" ) {
                let element = document.querySelector(data);
                dataWrapper = new FormData(element);
            }else if( data instanceof HTMLElement){
                dataWrapper = new FormData(data);
            }else if( data instanceof FormData){
                dataWrapper = data;
            }
    
            req.data = dataWrapper;
    
            next()
        },
        listen: function () {
            return this.parse.bind(this);
        }
    }

    /**
     * request
     */
    var goRequest = function(uri, data, config = {}) {
        const defaultConfig = {'method': 'POST', 'mode': 'cors', 'credentials': 'same-origin', 'body':null};
        this.handler  = new Middleware();

        this.uri = uri;
        this.data = data;
        this.config = { ...defaultConfig, ...config};
        this.original;
    }

    goRequest.prototype = {
        use: function(fn){
            if( !fn ) {
                return;
            }
            this.handler.use(fn);
        },
        build: function() {
            this.config.body = this.data;
            this.original = new Request(this.uri, this.config);
            this.handler.go(this, ()=>console.log("building request"))
        }
    }

    var bounds = {
        init: function() {
            this.config = {};
            this.hash = Math.random();
            this.urlAdapter = null;
            this.extras = null;
            this.handler  = new Middleware();
            this.requestStack = [];

            this.use(this.validateResponse);
            this.use(this.parseResponse);
        },
        new: function () {
            return goland();
        },
        get factory() {
            return goFactory;
        },
        set: function(config) {
            if( typeof config != 'object' ) {
                throw new Error("config is not a object");
            }
            this.config = {... this.config, config};

            return this;
        },
        gopost: function(uri, data = null, extras) {
            this.set({method:'POST'}).go(uri, data, extras);
        },
        goget: function(uri, data = null, extras ) {
            this.set({method:'GET'}).go(uri, data, extras);
        },
        go:function(uri, data = null, extras) {
            this.extras = extras;
            
            var req = new goRequest(uri, data, this.config);

            for( let fn of this.requestStack) {
                req.use(fn);
            }

            req.build();
//on response
            return fetch(req.original).then((res) => {
                res.extras = this.extras;
                this.handler.go(res,()=>console.log("request end..."))
            }).catch( (err) => console.log(err) );
        },
        use: function(eventName = 'onresponse', fn) {
        	if( eventName == 'onresponse' || eventName == 'onrequest' && !fn ) {
                throw new Error("fn is not a function");
            }

            if( eventName == 'onrequest' ) {
            	this.requestStack.push(fn)
            }else if( eventName == 'onresponse' ) {
            	this.handler.use(fn);
            }
        },
        validateResponse : function(res, next){
            console.log("validating response...");
            if( !res.ok ) {
                throw new Error(res.statusText);
            }

            if( res.status < 200 || res.status > 300) {
                throw new Error(res.statusText);
            }
            
            next();
        },
        parseResponse: function(res, next) {
            console.log("parsing response...");
            let contentType = res.headers.get('Content-Type');
            let text, type;
    
            switch(contentType) {
                case 'application/json':
                    text =  res.json();
                    type = 'json';
                    break;
                default:
                    type = 'text';
                    text =  res.text();
                    break;
            }
            text.then( (data) => {
                            res.text = data;
                            res.json = type == "json" ? res.text : null;
                            next();
                        }
            );
        }
    };
    
    var goland = function maker() {
        var instance;
    
        var go = function(uri = null, data = null, extras = null) {
            
            if( !instance ){
                instance = new go.fn.init();
            }

            if( uri ) {
                instance.go(uri, data, extras)
            }

            return instance;
        }

        go.fn = go.prototype = bounds;
        
        go.fn.init.prototype = go.prototype;

        return go;
    }

    w.gocloud = goland();

})(window)
