(function () {
    VR.Pages = VR.Pages || {};

    var IndexConstructor = function () {
    };
    IndexConstructor.prototype = {
        startingExtent:new OpenLayers.Bounds(-75.442428588868, 39.783554077149, -74.893112182618, 40.195541381837),

        startup:function () {
            console.debug("Hello World!");

            this.setupMap();
            this.connectEvents();

            console.debug("Page done loading...");
        },

        connectEvents:function () {
            $("#btnClear").on('click', $.proxy(this.onClearClicked, this));

        },

        onClearClicked:function () {
            this.clearMap();
        },

        clearMap:function () {
            console.debug("clear map clicked");
        },


        setupMap:function () {
            var map = new OpenLayers.Map('map');
            var wms = new OpenLayers.Layer.WMS("OpenLayers WMS",
                "http://vmap0.tiles.osgeo.org/wms/vmap0?", {layers:'basic'});



            //var vectors = new OpenLayers.Layer.Vector("Vector Layer");
            var pointLayer = new OpenLayers.Layer.Vector("Point Layer");

            map.addLayers([wms, pointLayer]);
            map.addControl(new OpenLayers.Control.MousePosition());

            var drawControl = new OpenLayers.Control.DrawFeature(pointLayer, OpenLayers.Handler.Point);
            drawControl.events.register('featureadded', this, this.onMapClicked);
            map.addControl(drawControl);
            drawControl.activate();





            this.layers = {
                points: pointLayer
            };
            this.mapControls = {
                drawControl: drawControl
            };
            map.zoomToExtent(this.startingExtent);

            //TODO: draw feature control
            //map.events.register("click", map, $.proxy(this.onMapClicked, this));
            this.map = map;
            this.loadAllRoutes();
        },

        loadAllRoutes: function() {

            $.ajax({
                url: "data/routeIDs.js",
                dataType:"json",
                success:$.proxy(this.onRouteIDsReturned, this),
                error: function() {
                    console.error("Get locations returned an error, ", arguments);
                }
            })

        },

        onRouteIDsReturned: function(data) {
            for(var id in data.routes) {
                this.addRoute(id);
            }
        },

        pointsStyleMap: function () {
            return new OpenLayers.StyleMap({
                "default": new OpenLayers.Style({
                    pointRadius: "${type}", // sized according to type attribute
                    fillColor: "#ffcc66",
                    strokeColor: "#ff9933",
                    strokeWidth: 2,
                    graphicZIndex: 1
                }),
                "select": new OpenLayers.Style({
                    fillColor: "#66ccff",
                    strokeColor: "#FF0000",
                    graphicZIndex: 2
                })
            });
        },

        kmlRouteStyleMap: function () {
            return new OpenLayers.StyleMap({
                "default": new OpenLayers.Style({
                    fillColor: "#ffcc66",
                    strokeColor: "#e1e1e1",
                    strokeWidth: 1,
                    graphicZIndex: 1
                }),
                "select": new OpenLayers.Style({
                    fillColor: "#66ccff",
                    strokeColor: "#000",
                    strokeWidth: 2,
                    graphicZIndex: 2
                })
            });
        },


        kmlRoutes:{},
        addRoute:function (route) {

            var styleMap = this.kmlRouteStyleMap();

            if (!this.kmlRoutes[route]) {
                this.kmlRoutes[route] = new OpenLayers.Layer.Vector("KML", {
                    styleMap: styleMap,
                    strategies:[new OpenLayers.Strategy.Fixed()],
                    protocol:new OpenLayers.Protocol.HTTP({
                        url:"data/routekml/" + route + ".kml",
                        format:new OpenLayers.Format.KML({
                            extractStyles:false,
                            extractAttributes:true,
                            maxDepth:2
                        })
                    })
                });

                this.map.addLayer(this.kmlRoutes[route]);
            }
        },


        onMapClicked:function (evt) {
            var feature = evt.feature;
            console.debug('map clicked ', arguments);

//            var filt =  new OpenLayers.Filter.Spatial({
//                type: OpenLayers.Filter.Spatial.DWITHIN,
//                value: feature.geometry,
//
////                type: OpenLayers.Filter.Spatial.BBOX,
////                value: feature.geometry.getBounds(),
//
//                distanceUnits: 'm',
//                distance: 10
//            });

            //is 'f' in range of 'feature'
            var distanceThreshold = 0.0012;
            var inRange = function(src, dest) {
                var dist = src.geometry.distanceTo(dest.geometry);
                console.debug('distance is ', dist);
                return (dist <= distanceThreshold)
            };

            var selectFeature = function(layer, feat) {
                layer.selectedFeatures.push(feat);
                feat.renderIntent = "select";
            };

            for(var id in this.kmlRoutes) {
                var layer = this.kmlRoutes[id];
                if (!layer || (layer.features.length == 0)) {
                    continue;
                }
//                layer.filter = filt;

                for(var fid in layer.features) {
                    var feat = layer.features[fid];
                    //if (filt.evaluate(feat)) {
                    if (inRange(feat, feature)) {
                        console.debug('selecting feature ', fid);
                        selectFeature(layer, feat);
                    }
                }
                layer.redraw();
                //layer.refresh({force: true});
            }
//            layer.filter = new OpenLayers.Filter.Spatial({
//                type: OpenLayers.Filter.Spatial.INTERSECTS,
//                value: event.feature.geometry
//            });







//            $.ajax({
//                url:"http://www3.septa.org/hackathon/locations/get_locations.php?lon=-75.161&lat=39.95205&callback=?",
//
//                dataType:"jsonp",
//                success:$.proxy(this.onLocationsReturned, this),
//                error: function() {
//                    console.error("Get locations returned an error, ", arguments);
//                }
//            });
        },

        onLocationsReturned:function (data) {
            console.debug('data returned !', data);
//
//
//            location_id
//
//            location_name
//            location_type :  bus_stops  trolley_stops
//            location_lat
//            location_lon
//            distance

//            function (data) {
//                                $.each(data, function (i, item) {
//                                    var locname = item.location_name;
//                                    if (item.location_type == 'perk_locations') {
//
//                                        if (item.location_data != null)
//                                            alert(item.location_data.location_id + ' ' + item.location_data.location_name);
//                                    }
//
//                                });
//                            }
        },


        foo:'bar'
    };

    $(function () {
        VR.Pages.index = new IndexConstructor();
        VR.Pages.index.startup();
    });

})();
