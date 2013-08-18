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
}

var CamerasView = Backbone.View.extend({
    initialize: function() {
        this.itemTemplate = Handlebars.compile($('#camera-list-item-template').html());
    },
    render: function() {
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
        this.$el.append("<ul id='events-list'></ul>");
        this.model.get('events').each(function(event) {
            var link = $(this.itemTemplate(event.toJSON()));
            this.$("#events-list").append(link);
            link.click(function() {
                showEvent(event);
                return false;
            });
        }, this);
        return this;
    }

});

var AppRouter = Backbone.Router.extend({
    routes: {
        "":"index",
        "cameras/:name":"camera"
    },
    initialize: function() {

    },
    index: function() {
        var router = this;
        $("#main").html('');
        this.cameras = new Cameras();
        this.cameras.fetch({
            success: function() {
                var view = new CamerasView({
                    collection: router.cameras,
                    el: $("#main")
                });
                view.render();
            }
        });
    },
    camera: function(name) {
        $("#main").html('');
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
            }
        });
    }
});