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
            $("#info").html("");


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
                points:pointLayer
            };
            this.mapControls = {
                drawControl:drawControl
            };
            map.zoomToExtent(this.startingExtent);

            //TODO: draw feature control
            //map.events.register("click", map, $.proxy(this.onMapClicked, this));
            this.map = map;
            this.loadAllRoutes();
        },

        loadAllRoutes:function () {

            $.ajax({
                url:"data/routeIDs.js",
                dataType:"json",
                success:$.proxy(this.onRouteIDsReturned, this),
                error:function () {
                    console.error("Get locations returned an error, ", arguments);
                }
            })

        },

        onRouteIDsReturned:function (data) {
            for (var id in data.routes) {
                this.addRoute(id);
            }
        },

        pointsStyleMap:function () {
            return new OpenLayers.StyleMap({
                "default":new OpenLayers.Style({
                    pointRadius:"${type}", // sized according to type attribute
                    fillColor:"#ffcc66",
                    strokeColor:"#ff9933",
                    strokeWidth:2,
                    graphicZIndex:1
                }),
                "select":new OpenLayers.Style({
                    fillColor:"#66ccff",
                    strokeColor:"#FF0000",
                    graphicZIndex:2
                })
            });
        },

        kmlRouteStyleMap:function () {
            return new OpenLayers.StyleMap({
                "default":new OpenLayers.Style({
                    fillColor:"#ffcc66",
                    strokeColor:"#e1e1e1",
                    strokeWidth:1,
                    graphicZIndex:1
                }),
                "select":new OpenLayers.Style({
                    fillColor:"#66ccff",
                    strokeColor:"#000",
                    strokeWidth:1,
                    graphicZIndex:2
                }),
                "highlight":new OpenLayers.Style({
                    fillColor:"#66ccff",
                    strokeColor:"#0015FF",
                    strokeWidth: 2,
                    graphicZIndex:2
                })

            });
        },


        kmlRoutes:{},
        addRoute:function (route) {

            var styleMap = this.kmlRouteStyleMap();

            if (!this.kmlRoutes[route]) {
                this.kmlRoutes[route] = new OpenLayers.Layer.Vector("KML", {
                    styleMap:styleMap,
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

            //is 'f' in range of 'feature'
            var distanceThreshold = 0.005;      //todo: tie this to something practical
            var inRange = function (src, dest) {
                var dist = src.geometry.distanceTo(dest.geometry);
                //console.debug('distance is ', dist);
                return (dist <= distanceThreshold)
            };

            var selectFeature = function (layer, feat) {
                layer.selectedFeatures.push(feat);
                feat.renderIntent = "select";
            };

            var validFeatures = [];

            for (var id in this.kmlRoutes) {
                var layer = this.kmlRoutes[id];
                if (!layer || (layer.features.length == 0)) {
                    continue;
                }
//                layer.filter = filt;

                for (var fid in layer.features) {
                    var feat = layer.features[fid];
                    feat.renderIntent = "default";
                    if (inRange(feat, feature)) {
                        selectFeature(layer, feat);
                        validFeatures.push({layer:layer, feature:feat});
                    }
                }
                layer.redraw();
            }

            this.createSelectionDivs(validFeatures);


        },

        _lastHighlighted: null,

        /**
         * Assumes you know what render intent you want the old feature to revert to!
         * @param feature
         * @param resetTo
         */
        highlightFeature: function(feature, resetTo) {
            if (this._lastHighlighted) {
                this._lastHighlighted.renderIntent = resetTo;
                this._lastHighlighted.layer.redraw();
                this._lastHighlighted = null;
            }

            feature.renderIntent = "highlight";
            this._lastHighlighted = feature;
            feature.layer.redraw();
        },


        /**
         * Takes an array of {layer: null, feature: null} items and
         * redraws an area of the screen to have interactive divs for each
         * should:
         *  highlight on hover?
         *  show route name?
         * @param items
         */
        createSelectionDivs:function (items) {
            var $node = $("#info").find(".highlighted");
            var map = this.map;


            for (var id in items) {
                var item = items[id];
                var name = item.feature.attributes.name;
                var h = "<div>" +
                    "<span class='name'>" + name + "</span>" +
                    "<button class='zoom'>Zoom to Route</button>" +
                    "</div>";

                var $h = $(h);
                $h.appendTo($node);

                //CONTEXT is page!
                var highlightFn = $.proxy(this.highlightFeature, this);

                $($h).find(".zoom").on("click", $.proxy(function () {
                    //CONTEXT is "item"

                    console.debug('zooming to item ', this.feature.attributes.name);
                    highlightFn(this.feature);
                    map.zoomToExtent(this.feature.geometry.getBounds());
                }, item));
            }

        },


        foo:'bar'
    };

    $(function () {
        VR.Pages.index = new IndexConstructor();
        VR.Pages.index.startup();
    });

})();
