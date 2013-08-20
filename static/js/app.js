var Camera = Backbone.Model.extend({
    idAttribute: "name",
    urlRoot: "/api/cameras/",
    parse: function(data) {
        if ( _.isObject(data.results) ) {
            return data.results;
        } else {
            if (data.events) {
                data.events = new Events(data.events);
            }
            return data;
        }
    }
});
var Cameras = Backbone.Collection.extend({
    model: Camera,
    url: "/api/cameras/"
});

var Event = Backbone.Model.extend();
var Events = Backbone.Collection.extend({
    model: Event,
});

function showEvent(event) {
    $("#event-viewer #title").html(event.get('name'));
    swfobject.embedSWF(event.get('url') + "?format=swf", "movie-container", "640", "480", "9.0.0");
    $("#event-viewer").modal('show');
    window.router.navigate(window.baseUrl + "#" + event.get('id'));
    $('#event-viewer').on('hidden', function () {
        window.router.navigate(window.baseUrl);
    });
}

var CamerasView = Backbone.View.extend({
    initialize: function() {
        this.itemTemplate = Handlebars.compile($('#camera-list-item-template').html());
        this.listenTo(this.collection, 'change reset add remove', this.render);
    },
    render: function() {
        this.$el.html('<h2>Available Cameras</h2>');
        this.$el.append("<ul id='camera-list'></ul>");
        this.collection.each(function(camera) {
            this.$("#camera-list").append(this.itemTemplate(camera.toJSON()));
        }, this);
        this.$("a").click(function() {
            var url = $(this).attr('href');
            window.router.navigate(url, {trigger:true});
            return false;
        });
        return this;
    }
});

var CameraView = Backbone.View.extend({
    initialize: function() {
        this.itemTemplate = Handlebars.compile($('#events-list-item-template').html());
    },
    render: function() {
        this.$el.html('');
        this.$el.append("<div id='events-timeline'></div>");
        var data = [];
        this.model.get('events').each(function(event) {
            var t = event.get('timestamp');
            var timestamp = new Date(Date.UTC(t.year, t.month-1, t.day, t.hour, t.min, t.sec, 0)); 
            data.push({
                'start': timestamp,
                'content': this.itemTemplate(event.toJSON())
            });
        }, this);

        var timeline = new links.Timeline(document.getElementById('events-timeline'));
        timeline.draw(data, {
            'style':'box'
        });
        var view = this;
        this.$("a").click(function() {
            var event_id = $(this).attr('event-id');
            var event = view.model.get('events').get(event_id);
            showEvent(event);
            return false;
        });
        return this;
    }
});

var MenuView = Backbone.View.extend({
    initialize: function() {
        this.itemTemplate = Handlebars.compile($('#menu-list-item-template').html());
        this.listenTo(this.collection, 'change reset add remove', this.render);
        // Bind to router change events so we can update the active class on the current
        // camera entry
        Backbone.history.on("all", this.render, this);
    },
    render: function() {
        this.$("#camera-list").html('');
        this.collection.each(function(camera) {
            var link = $(this.itemTemplate(camera.toJSON()));
            if(document.URL.indexOf(camera.get('name')) != -1) {
                link.addClass('active');
            }
            this.$("#camera-list").append(link);
        }, this);
        this.$("a").click(function() {
            var url = $(this).attr('href');
            window.router.navigate(url, {trigger:true});
            return false;
        });
        return this;
    }
});

var AppRouter = Backbone.Router.extend({
    routes: {
        "":"index",
        "cameras/:name":"camera"
    },
    initialize: function() {
        this.cameras = new Cameras();
        this.menuView = new MenuView({
            el: $("div.navbar-fixed-top"),
            collection: this.cameras
        });
        this.cameras.fetch({
            success: function() {
                window.router.menuView.render();
            }
        });
    },
    index: function() {
        window.baseUrl = '';
        $("#main").html('');
        var view = new CamerasView({
            collection: window.router.cameras,
            el: $("#main")
        });
        view.render();
    },
    camera: function(name) {
        $("#main").html('');
        window.baseUrl = 'cameras/' + name;
        var camera = new Camera({
            name: name
        });
        camera.fetch({
            success: function() {
                var view = new CameraView({
                    model: camera,
                    el: $("#main")
                });
                view.render();
                var hash = window.location.hash.replace("#", "");
                if(hash) {
                    var event = camera.get('events').get(hash);
                    if(event) showEvent(event);
                }
            }
        });
    }
});