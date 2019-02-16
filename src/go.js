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
        makeRouter: function (mediator) {
            return new router(mediator);
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
    var router = function (mediator) {
        this.hash = Math.random();
        this.handler  = new Middleware();
        this.mediator = mediator;
    }

    router.prototype = {
        match: function (regex, fn) {
            this.handler.use((data, next) =>  {
                this.mediator.validate(regex, data ? data.url : null) && fn(data, this.mediator.extras)
                next();
            })
        },
        use: function(fn){
            if( !fn ) {
                throw new Error("fn is not a function");
            }
            console.log("append roter " + fn.name)
            this.handler.use(fn);
        },
        listen: function (response) {
            this.handler.go(response, ()=>console.log("router "+ this.hash +" handling request"))
        }
    }

    /**
     * request
     */
    var goRequest = function(uri, data) {
        this.handler  = new Middleware();

        this.uri = uri;
        this.data = data;
        this.config = {'method': 'POST', 'mode': 'cors', 'credentials': 'same-origin', 'body':null};
        this.original;
    }

    goRequest.prototype = {
        use: function(fn){
            if( !fn ) {
                return;
            }
            this.handler.use(fn);
        },
        build: function(){
            this.handler.go(this, ()=>console.log("building request"))
        }
    }

    function adaptRequestData(req, next) {

        if( req.data == null) {
            next();
            return;
        }
        
        let dataWrapper = null;
        let data = req.data;
        
        if( data instanceof HTMLElement){
            dataWrapper = new FormData(data);
        }else if( data instanceof FormData){
            dataWrapper = data;
        }else if( typeof data === "object" ) {
            //dataWrapper = JSON.stringify({"data":data}) no soported yet
            dataWrapper = new FormData();
            for (i in data) {
                dataWrapper.append(i, data[i])
            }
        }else if ( typeof data === "string" ) {
            let element = document.querySelector(data);
            dataWrapper = new FormData(element);
        }

        req.data = dataWrapper;

        next()
    }
    
    function adaptResponseData(res, next) {

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

    function validateNativeResponse(res, next) {
        console.log("validating response...");
        if( !res.ok ) {
            throw new Error(res.statusText);
        }

        if( res.status < 200 || res.status > 300) {
            throw new Error(res.statusText);
        }
        
        next();
    }

    var bounds = {
        init: function() {
            this.hash = Math.random();
            this.localRouter = new router(this);
            this.validator = this.factory.makeValidator();

            this.urlAdapter = null;
            this.extras = null;

            this.localRouter.use(this.validateResponse);
            this.localRouter.use(this.parseResponseData);
        },
        new: function () {
            return goland();
        },
        get factory() {
            return goFactory;
        },
        setValidator: function(validator) {
            this.validator = validator;
        },
        setUrlAdapter:function(adapter) {
            this.urlAdapter = adapter;
        },
        router: function (regex, fn) {
            this.localRouter.match(regex, fn);
            return this;
        },
        go:function(uri, data = null, arg3 = null) {
            this.extras = arg3;
            
            var req = new goRequest(uri, data);

            if( data ) {
                req.use(this.parseRequestData)
            }

            if( this.urlAdapter ) {
                req.use(this.urlAdapter.adapt);
            }

            req.build();
            req.config.body = req.data;
            req.original = new Request(req.uri, req.config);

            const handleResponse = this.localRouter.listen.bind(this.localRouter);

            return fetch(req.original).then(handleResponse).catch( (err) => console.log(err) );
        },
        validate: function (regex, data) {
            return this.validator.validate(regex, data);
        },
        parseRequestData : adaptRequestData,
        validateResponse : validateNativeResponse,
        parseResponseData : adaptResponseData
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

    w.goCloud = goland();

})(window)
