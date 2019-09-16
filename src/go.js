// v1.0.0
// https://github.com/malcam/gocloud

var Middleware = function() {};

Middleware.prototype.use = function(fn) {
    var self = this;

    this.stuff = (stack) => (ctx, next) => { // la primera vez esta es next, por tal en subcadenas se requiere enviar ctx almenos en el primer eslabon
                            stack.call(self, ctx, function() { //la siguientes veces esta funcion es next
                            fn.call(self, ctx, next.bind(self));
                        });
    };

    this.go = this.stuff(this.go);
   //this.go = (stack => (res,next) => stack( res, (data) => fn.bind(this, ( data || res) , next.bind(this)) ))(this.go);
};

Middleware.prototype.go = function(ctx, next) {
  next(ctx);
};

(function(w){

    function regexValidatorFn( pattern, str ) {
        return new RegExp(pattern, 'i').test(str);
    }

    function command(fn) {
        return (req, next)  => { fn(req); next(); };
    }

    function validateResponseMiddleware(ctx, next){
      if(ctx.env === 'devel') {
        console.log("Validating response...");
      }

      const response = ctx.response;

      if( !response.ok ) {
        throw new Error(response.statusText);
      }

      if( response.status < 200 || response.status > 300) {
        throw new Error(response.statusText);
      }

      next(ctx);
    }

    function parseResponseMiddleware(ctx, next) {
      if(ctx.env === 'devel') {
        console.log("parsing response...");
      }

      const response = ctx.response;
      let contentType = response.headers.get('Content-Type');
      let text, type;

      switch(contentType) {
        // TODO: implementar regex
        case 'application/json; charset=utf-8':
          text =  response.json();
          type = 'json';
          break;
        case 'application/json':
          text =  response.json();
          type = 'json';
          break;
        default:
          type = 'text';
          text =  response.text();
          break;
      }
      text.then( (data) => {
            ctx.body = data;
            next(ctx);
          }
      );
    }

    const goFactory = {
        makeRouter: function (validator = { validate: regexValidatorFn }) {
            return new router(validator);
        },
        makeParser: function() {
            return new parser;
        },
        makeUrlAdapter: function (fn) {
            if( !fn ) {
                throw new Error("fn is not a function");
            }
            return { adapt: command(fn) }
        }
    };

/**
 * Router
 */
    const router = function (validator) {
        this.hash = Math.random();
        this.handler  = new Middleware();
        this.validator = validator;
    };

    router.prototype = {
        match: function (regex, fn) {
            this.handler.use((ctx, next) =>  {
                this.validator.validate(regex, ctx.request.uri) && fn(ctx);
                next(ctx);
            })
        },
        use: function(fn) {
          if( !fn ) {
            throw new Error("fn is not a function");
          }
          this.handler.use(fn);
          console.log("append roter " + fn.name);
        },
        listen: function () {
            this.routes()();
        },
        routes: function () {
          return (ctx = { request: { uri: '' } }, next = null) => {
            this.handler.go(ctx, ()=>console.log("router "+ this.hash +" handling request"))
            // no requiere llamar next al principio de una nueva cadena,
            // pero si se requiere en cadenas subsecuentes, igual que el parametro ctx
            // como esta funcion se usa de las dos maneras se valida que la funcion exista
            next && next(ctx);
          }
        }
    };

    const parser = function() {
        this.hash = Math.random();
    };

    parser.prototype = {
        parse: function(ctx, next) {

            const request = ctx.request;

            if( request.body == null) {
                next(ctx);
                return;
            }
            
            let dataWrapper = null;
            let data = request.body;

            if( data instanceof FormData){
                dataWrapper = data;
            }else if( typeof data === "object" ) {
                dataWrapper = JSON.stringify(data)
            }else if ( typeof data === "string" ) {
                let element = document.querySelector(data);
                dataWrapper = new FormData(element);
            }else if( data instanceof HTMLElement){
                dataWrapper = new FormData(data);
            }

            request.body = dataWrapper;

            next(ctx);
        },
        listen: function () {
            return this.parse.bind(this);
        }
    };

    /**
     * request
     */
    const goRequest = function(uri, data, config = {}) {
        const defaultConfig = {'method': 'GET', 'mode': 'cors', 'credentials': 'same-origin', 'body': data};
        this.uri = uri;
        this.data = data;
        this.config = { ...defaultConfig, ...config};
    };

    goRequest.prototype = {
      buildRaw(){
        return new Request(this.uri, this.config)
      }
    };

    /**
     * request
     */
    const goResponse = function() {
      this.handler  = new Middleware();
    };

    goResponse.prototype = {
    };

    const bounds = {
        init: function() {
            this.config = {};
            this.hash = Math.random();
            this.extras = null;
            this.handler  = new Middleware();

            this.use(this.handleRequest);
            this.use(validateResponseMiddleware);
            this.use(parseResponseMiddleware);
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
            this.config = {...this.config, ...config};

            return this;
        },
        post: function(uri, data = null, extras = null) {
            const tmpConfig = this.config;
            const response =    this.set({method:'POST'}).go(uri, data, extras);
            this.config = tmpConfig;
            return response;
        },
        get: function(uri, data = null, extras = null) {
            return this.set({method:'GET'}).go(uri, data, extras);
        },
        put: function(uri, data = null, extras = null ) {
            const tmpConfig = this.config;
            const response =  this.set({method:'PUT'}).go(uri, data, extras);
            this.config = tmpConfig;
            return response;
        },
        go: function(uri, data = null, extras = null) {

          return new Promise( (resolve, reject) => {
              this.handler.go({request: new goRequest(uri, data, this.config), extras, env: 'devel'}, (ctx)=>{
                if(ctx.env === 'devel') {
                  console.log('Request Start...');
                }
                resolve(ctx);
              });
          });

        },
        use: function(fn) {
            if( !fn ) {
                throw new Error("fn is not a function");
            }

            this.handler.use(fn);
        },
        handleRequest(ctx, next) {
          fetch(ctx.request.buildRaw())
          .then( (response) => {
            ctx.response = response;
            next(ctx);
          })
          .catch( (err) => console.log(err) );
        }
    };
    
    var goland = function maker() {
        var instance;
    
        var go = function(uri = null, data = null, extras = null) {
            
            if( !instance ){
                instance = new go.fn.init();
            }

            if( uri ) {
                return instance.go(uri, data, extras)
            }

            return instance;
        };

        go.fn = go.prototype = bounds;
        
        go.fn.init.prototype = go.prototype;

        return go;
    };

    w.gocloud = goland();

})(window);
