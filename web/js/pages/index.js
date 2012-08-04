(function () {
    VR.Pages = VR.Pages || {};

    var IndexConstructor = function () {
    };
    IndexConstructor.prototype = {
        startingExtent:new OpenLayers.Bounds(-75.442428588868, 39.783554077149, -74.893112182618, 40.195541381837),
        routeNames:null,

        bufferFeet:1000,
        bufferMapUnits:null,

        startup:function () {
            console.debug("Hello World!");
            this.bufferMapUnits = this.convertTo(this.bufferFeet, 'ft', 'degrees'); //this.map.getUnits());


            this.retrieveBaseLayer($.proxy(this.setupMap, this));

            //this.setupMap();
            this.connectEvents();
            this.getRouteNames();


            console.debug("Page done loading...");
        },

        connectEvents:function () {
            $("#btnClear").on('click', $.proxy(this.onClearClicked, this));

        },

        getRouteNames:function () {
            console.debug('requesting route names file ');
            $.ajax({
                url:"data/routeNames.js",
                dataType:"json",
                success:$.proxy(this.onRouteNamesLoaded, this)
            });
        },
        onRouteNamesLoaded:function (data) {
            console.debug('route names returned ');
            this.routeNames = {};
            for (var idx in data.routeNames) {
                var item = data.routeNames[idx];
                //console.debug("adding route name ", item);
                this.routeNames[item.route] = item;
            }
        },


        onClearClicked:function () {
            //clear all the buttons we've added
            $("#info .highlighted").html("");

            this.clearMap();
        },

        clearMap:function () {
            console.debug("clear map clicked");

            //destroy all the points we've drawn
            this.layers.points.destroyFeatures();

            //RESET ALL SELECTED / HIGHLIGHTED ROUTES
            this._lastHighlighted = null;
            for (var id in this.kmlRoutes) {
                var layer = this.kmlRoutes[id];
                if (!layer || (layer.features.length == 0)) {
                    continue;
                }
                for (var fid in layer.features) {
                    var feat = layer.features[fid];
                    feat.renderIntent = "default";
                }
                layer.redraw();
            }
        },


        retrieveBaseLayer:function (callback) {
            var layerURL = "http://services.arcgisonline.com/ArcGIS/rest/services/ESRI_Imagery_World_2D/MapServer";
            $.ajax({
                url:layerURL + "?f=json&pretty=true",
                dataType:"jsonp",
                success:$.proxy(function (layerInfo) {

                    var baseLayer = new OpenLayers.Layer.ArcGISCache("AGSCache", layerURL, {
                        layerInfo:layerInfo,
                        transitionEffect:'resize'
                    });

                    var map = new OpenLayers.Map('map', {
                        maxExtent:baseLayer.maxExtent,
                        units:baseLayer.units,
                        resolutions:baseLayer.resolutions,
                        numZoomLevels:baseLayer.numZoomLevels,
                        tileSize:baseLayer.tileSize,
                        displayProjection:baseLayer.displayProjection
                    });
                    map.addLayers([baseLayer]);
                    callback(map);

                }, this)
            });

        },


        setupMap:function (providedMap) {
            var map = providedMap;
            if (!map) {
                map = new OpenLayers.Map('map');
                var wms = new OpenLayers.Layer.WMS("OpenLayers WMS",
                    "http://vmap0.tiles.osgeo.org/wms/vmap0?", {
                        layers:'basic',
                        transitionEffect:'resize'
                    });
                map.addLayer(wms);
            }
            this.map = map;


            //var vectors = new OpenLayers.Layer.Vector("Vector Layer");
            var pointLayer = new OpenLayers.Layer.Vector("Point Layer", {
                styleMap:this.pointsStyleMap()
            });

            map.addLayers([ pointLayer]);
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

        calculateRadiusPx:function (map, bufferUnits) {
            if (!bufferUnits) {
                return 0;
            }

            //buffer units had better be in map units.
            var radius = bufferUnits / map.getResolution();
            console.debug('calc radius returning ', radius);
            return radius;
        },

        supported:function () {
            return !!((typeof "OpenLayers" != "undefined") && (OpenLayers.INCHES_PER_UNIT));
        },
        convertTo:function (value, srcType, destType) {
            if (!this.supported()) {
                console.error("OpenLayers must be loaded for this library to work");
            }

//             srcType = this.coalesceType(srcType);
//             destType = this.coalesceType(destType);

            var inchesPerSrc = OpenLayers.INCHES_PER_UNIT[srcType];
            var inchesPerDest = OpenLayers.INCHES_PER_UNIT[destType];
            return ((value * inchesPerSrc) / inchesPerDest);
        },


        pointsStyleMap:function () {
            var that = this;

            var determineRadius = function (f) {
                return that.calculateRadiusPx(that.map, that.bufferMapUnits);
            };
            console.debug("converted value is ", that.bufferMapUnits);

            //TODO: pointRadius with real distance


            return new OpenLayers.StyleMap({
                    "default":new OpenLayers.Style({
                            pointRadius:"${radius}",
                            fillColor:"#0015FF",
                            strokeColor:"#333",
                            strokeWidth:2,
                            fillOpacity:0.3,
                            graphicZIndex:1
                        },
                        {
                            context:{ radius:determineRadius }
                        }),
                    "select":new OpenLayers.Style({
                        fillColor:"#66ccff",
                        strokeColor:"#FF0000",
                        graphicZIndex:2
                    })
                }
            );
        },

        kmlRouteStyleMap:function () {
            return new OpenLayers.StyleMap({
                "default":new OpenLayers.Style({
                    fillColor:"#ffcc66",
                    strokeColor:"#333", //near-black
                    strokeWidth:1,
                    graphicZIndex:1
                }),
                "select":new OpenLayers.Style({
                    fillColor:"#66ccff",
                    strokeColor:"#e1e1e1", //near-white
                    strokeWidth:3,
                    graphicZIndex:2
                }),
                "highlight":new OpenLayers.Style({
                    fillColor:"#66ccff",
                    strokeColor:"#0015FF",
                    strokeWidth:3,
                    graphicZIndex:2
                })

            });
        },


        kmlRoutes:{
        },
        addRoute:function (route) {

            var styleMap = this.kmlRouteStyleMap();

            if (!this.kmlRoutes[route]) {
                this.kmlRoutes[route] = new OpenLayers.Layer.Vector(route, {
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
            var distanceThreshold = this.bufferMapUnits;      //todo: tie this to something practical
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
                    //feat.renderIntent = "default";
                    if (inRange(feat, feature)) {
                        selectFeature(layer, feat);
                        validFeatures.push({layer:layer, feature:feat});
                    }
                }
                layer.redraw();
            }

            this.createSelectionDivs(feature, validFeatures);
            this.panZoomAroundQuery(feature);


        },


        extendBounds:function (bounds, buffer) {
            bounds.top += buffer * 1;
            bounds.left -= buffer * 1;
            bounds.bottom -= buffer * 1;
            bounds.right += buffer * 1;
            return bounds;
        },


        /**
         * Creates a bounding box around our query point that won't necessarily encompass
         * the entirety of the routes we got
         */
        panZoomAroundQuery:function (feature) {
            var bounds = feature.geometry.getBounds();
            console.debug("feature bounds are ", bounds);

            bounds = this.extendBounds(bounds, this.bufferMapUnits * 4);

            console.debug("zooming to ", bounds);
            this.map.zoomToExtent(bounds);
        },


        _lastHighlighted:null,

        /**
         * Assumes you know what render intent you want the old feature to revert to!
         * @param feature
         * @param resetTo
         */
        highlightFeature:function (feature, resetTo) {
            this.map.resetLayersZIndex();

            if (this._lastHighlighted) {
                this._lastHighlighted.renderIntent = resetTo;
                this._lastHighlighted.layer.redraw();
                this._lastHighlighted = null;
            }

            feature.renderIntent = "highlight";
            this._lastHighlighted = feature;
            feature.layer.setZIndex(1000);
            feature.layer.redraw();
        },

        resolvePointToAddress:function (feature, callback) {
            var pt = feature.geometry.getCentroid();

            $.ajax({
                //url:"http://maps.googleapis.com/maps/api/geocode/json?latlng=" + pt.y + "," + pt.x + "&sensor=false",
                url:"http://sampleserver1.arcgisonline.com/ArcGIS/rest/services/Locators/ESRI_Geocode_USA/GeocodeServer/reverseGeocode?location=" + pt.x + "," + pt.y + "&distance=100&f=json",
                dataType:"jsonp",
                success:function (data) {
                    try {
                        if (callback) {
                            callback(data);
                        }
                    }
                    catch (e) {
                        console.error("Error in callback ", e);
                    }

                },
                error:function () {
                    console.error("failed to resolve point ", arguments)
                }
            });
        },


        /**
         * Takes an array of {layer: null, feature: null} items and
         * redraws an area of the screen to have interactive divs for each
         * should:
         *  highlight on hover?
         *  show route name?
         * @param feature - originally drawn point
         * @param items
         */
        createSelectionDivs:function (feature, items) {
            var $root = $("#info .highlighted");
            var map = this.map;

            var orig = "<div>" +
                "<span class='reverseAddress'>Routes near (checking...) </span>" +
                "<ul> </ul></div>";

            //better way to create and append a div, while retaining a reference to it?
            var $node = $(orig);
            $($node).appendTo($root);

            var onAddressResolved = $.proxy(function (addresses) {
                if (!addresses) {
                    console.error("No addresses returned!");
                }

                var first = addresses.address;//[0];
                $($node).find('.reverseAddress').html("Routes near " + first.Address);
            }, this);
            this.resolvePointToAddress(feature, onAddressResolved);

            var $list = $($node).find("ul");

            if (!items || (items.length == 0)) {
                var h = "<divNo routes found nearby</div>";
                $(h).appendTo($list);
            }
            else {
                for (var id in items) {
                    var item = items[id];

                    var routeID = item.layer.name;
                    var name = item.feature.attributes.name;
                    var routeName = '';
                    if (this.routeNames) {
                        var routeInfo = this.routeNames[routeID];
                        routeName = (routeInfo) ? routeInfo.name : '';
                    }


                    var h = "" +
                        "<div class='route'>" +
                        " <div class='section'> " +
                        "  <div class='title'>" +
                        "   <span class='short_name'>" + name + "</span>" +
                        "  </div>" +
                        "  <span class='long_name'>" + routeName + "</span>" +
                        "   <div class='controls'>" +
                        "    " +
                        "  <div class='btn-group'>" +
                        "     <button class='btn btn-info zoom'><i class='icon-zoom-in'></i>Zoom</button>" +
                        "     <button class='btn buses'><i class='icon-eye-open'></i>Buses</button>" +
                        "     <button class='btn schedule'><i class='icon-time'></i>Schedule</button>" +
                        "     </div>" +
                        "   </div>" +
//                        "   <div class='section'>" +
//                        "    <span class='title'>Schedule</span>" +
//                        "    <div class='schedule'>loading...</div>" +
//                        "   </div>" +
                        " </div>" +
                        "</div>";


                    var $h = $(h);
                    $h.appendTo($list);

                    //CONTEXT is page!
                    var highlightFn = $.proxy(this.highlightFeature, this);

                    $($h).find(".zoom").on("click", $.proxy(function () {
                        //CONTEXT is "item"

                        console.debug('zooming to item ', this.feature.attributes.name);
                        highlightFn(this.feature, "select");
                        map.zoomToExtent(this.feature.geometry.getBounds());
                    }, item));

                    $($h).on("mouseover", $.proxy(function () {
                        highlightFn(this.feature, "select");
                    }, item));
                }
            }

        },


        foo:'bar'
    }
    ;

    $(function () {
        VR.Pages.index = new IndexConstructor();
        VR.Pages.index.startup();
    });

})
    ();
