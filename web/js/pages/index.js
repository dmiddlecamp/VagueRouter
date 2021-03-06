(function () {
    VR.Pages = VR.Pages || {};

    var IndexConstructor = function () {
    };
    IndexConstructor.prototype = {
        startingExtent:new OpenLayers.Bounds(-75.307592826415, 39.842640625978, -75.070356803465, 40.117298829103),
        routeNames:null,

        bufferFeet:1000,
        bufferMapUnits:null,
        /**
         * our map might be in 'meters', but we need to pass 'degrees' when we're converting distance
         */
        mapUnitsForConverting:"degrees",

        missingRoutes:",0,4,16,41,45,49,51,63,69,72,74,76,81,82,83,85,86,87,100,121,122,133,135,136,137,138,",
        routeZIndex:1000,
        markerZIndex:1020,

        startup:function () {
            console.debug("Hello World!");
            this.showStartupDialog();

            this.bufferMapUnits = this.convertTo(this.bufferFeet, 'ft', this.mapUnitsForConverting); //this.map.getUnits());


            this.retrieveBaseLayer($.proxy(this.setupMap, this));

            //this.setupMap();
            this.connectEvents();
            this.getRouteNames();


            console.debug("Page done loading...");
        },

        connectEvents:function () {
            $("#btnClear").on('click', $.proxy(this.onClearClicked, this));
            $("#btnFindMe").on('click', $.proxy(this.onFindMeClicked, this));

        },

        showStartupDialog:function () {
            $("#loadingDialog").modal({
                backdrop:'static',
                keyboard:true
            });
        },
        updateStartupDialogProgress:function (value) {
//            console.debug('updating progress to ', value);
            $("#loadingDialog .bar").css('width', value.toFixed(0) + "%");
        },
        closeStartupDialog:function () {
            $("#loadingDialog").modal('hide');
        },


        getRouteNames:function () {
            //console.debug('requesting route names file ');
            $.ajax({
                url:"data/routeNames.js",
                dataType:"json",
                success:$.proxy(this.onRouteNamesLoaded, this)
            });
        },
        onRouteNamesLoaded:function (data) {
//            console.debug('route names returned ');
            this.routeNames = {};
            for (var idx in data.routeNames) {
                var item = data.routeNames[idx];
                //console.debug("adding route name ", item);
                this.routeNames[item.route] = item;
            }
        },

        useCurrentLocation:false,
        onFindMeClicked:function () {
            var ctl = this.mapControls.geolocateControl;

            //TODO:

            this.useCurrentLocation = !this.useCurrentLocation;
            $("#btnFindMe").text((this.useCurrentLocation) ? "Using your location..." : "Find me");

            if (this.useCurrentLocation) {
                ctl.activate();
            }
            else {
                ctl.deactivate();
            }
        },


        onClearClicked:function () {
            //clear all the buttons we've added
            $("#routeAccordion").html("");

            this.clearMap();
        },

        clearMap:function () {
//            console.debug("clear map clicked");

            //destroy all the points we've drawn
            this.layers.points.destroyFeatures();
            this.layers.accuracyBubbles.destroyFeatures();

            //RESET ALL SELECTED / HIGHLIGHTED ROUTES
            this._lastHighlighted = {};
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

            this.clearAllLiveRoutes();
            this.clearAllRouteStops()
        },


        retrieveBaseLayer:function (callback) {
            var layerURL = "http://services.arcgisonline.com/ArcGIS/rest/services/ESRI_StreetMap_World_2D/MapServer";
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
            var accuracyBubbles = new OpenLayers.Layer.Vector("accuracyBubbles", {});

            map.addLayers([ accuracyBubbles, pointLayer ]);
            //map.addControl(new OpenLayers.Control.MousePosition());

            var geolocateControl = new OpenLayers.Control.Geolocate({
                id:'locate-control',
                watch:true,
                geolocationOptions:{
                    enableHighAccuracy:true,
                    maximumAge:30,
                    timeout:7000
                }
            });
            geolocateControl.events.register("locationupdated", this, this.onLocationUpdated);
            map.addControl(geolocateControl);


            var drawControl = new OpenLayers.Control.DrawFeature(pointLayer, OpenLayers.Handler.Point);
            drawControl.events.register('featureadded', this, this.onMapClicked);
            map.addControl(drawControl);
            drawControl.activate();


            this.layers = {
                points:pointLayer,
                accuracyBubbles:accuracyBubbles
            };
            this.mapControls = {
                drawControl:drawControl,
                geolocateControl:geolocateControl
            };
            map.zoomToExtent(this.startingExtent);

            //TODO: draw feature control
            //map.events.register("click", map, $.proxy(this.onMapClicked, this));
            this.loadAllRoutes();

            //call me last, after you've added all your initial layers...
            this.wireAllMapLayersToProgress();
        },

        _onFirstLocationUpdate:true,
        onLocationUpdated:function (e) {
            if (!this.useCurrentLocation) {
                return;
            }
            //console.debug('onLocationUpdated ', e);

            var accuracyBubbleStyle = {
                fillOpacity:0.1,
                fillColor:'#000',
                strokeColor:'#f00',
                strokeOpacity:0.6
            };
            var accuracyPointStyle = {
                graphicName:'cross',
                strokeColor:'#f00',
                strokeWidth:2,
                fillOpacity:0,
                pointRadius:10
            };

            var accuracyValue = this.convertTo(e.position.coords.accuracy, 'm', this.mapUnitsForConverting);


            var layer = this.layers.accuracyBubbles;
            layer.removeAllFeatures();
            layer.addFeatures([
                new OpenLayers.Feature.Vector(e.point.clone(), {}, accuracyPointStyle),
                new OpenLayers.Feature.Vector(
                    OpenLayers.Geometry.Polygon.createRegularPolygon(
                        new OpenLayers.Geometry.Point(e.point.x, e.point.y),
                        accuracyValue / 2.0, 50, 0
                    ), {}, accuracyBubbleStyle)
            ]);
            if (this._onFirstLocationUpdate) {
                this._onFirstLocationUpdate = false;
                this.map.zoomToExtent(layer.getDataExtent());
            }
        },


        loadAllRoutes:function () {
            this.updateStartupDialogProgress(5);

            $.ajax({
                url:"data/routeIDs.js",
                dataType:"json",
                success:$.proxy(this.onRouteIDsReturned, this),
                error:function () {
                    console.error("Get locations returned an error, ", arguments);
                }
            })

        },

        wireAllMapLayersToProgress:function (maxProgress) {
            maxProgress = (maxProgress || 90);
            var that = this;
            this.updateStartupDialogProgress(10);
            var layersDone = 0;
            var totalLayers = this.map.layers.length;

            var onLayerLoaded = function () {
                layersDone++;
                var value = (layersDone / totalLayers) * maxProgress;
                that.updateStartupDialogProgress(value);

                if (layersDone == totalLayers) {
                    that.updateStartupDialogProgress(95);
                    that.closeStartupDialog();
                }
            };

            for (var idx in this.map.layers) {
                var layer = this.map.layers[idx];
                if (layer.loading || !layer.drawn) {
                    layer.events.register('loadend', this, onLayerLoaded);
                }
                else {
                    //layer is already loaded.
                    onLayerLoaded();
                }

            }
        },


        /**
         * Returns true if the routeID is in the 'missingRoutes' string
         * @param id
         * @return {Boolean}
         */
        isRouteMissing:function (id) {
            return (this.missingRoutes.indexOf(',' + id + ',') >= 0);
        },

        onRouteIDsReturned:function (data) {
            for (var id in data.routes) {
                if (this.isRouteMissing(id)) {
                    continue;
                }
                this.addRoute(id);
            }
        },

        calculateRadiusPx:function (map, bufferUnits) {
            if (!bufferUnits) {
                return 0;
            }

            //buffer units had better be in map units.
            var radius = bufferUnits / map.getResolution();
            //console.debug('calc radius returning ', radius);
            return radius;
        },

        supported:function () {
            return !!((typeof "OpenLayers" != "undefined") && (OpenLayers.INCHES_PER_UNIT));
        },
        convertTo:function (value, srcType, destType) {
            if (!this.supported()) {
                console.error("OpenLayers must be loaded for this library to work");
            }

            var inchesPerSrc = OpenLayers.INCHES_PER_UNIT[srcType];
            var inchesPerDest = OpenLayers.INCHES_PER_UNIT[destType];
            return ((value * inchesPerSrc) / inchesPerDest);
        },


        pointsStyleMap:function () {
            var that = this;
            var determineRadius = function (f) {
                return that.calculateRadiusPx(that.map, that.bufferMapUnits);
            };

            return new OpenLayers.StyleMap({
                "default":new OpenLayers.Style({
                    pointRadius:"${radius}",
                    fillColor:"#0015FF",
                    strokeColor:"#333",
                    strokeWidth:2,
                    fillOpacity:0.3,
                    graphicZIndex:1
                }, { context:{ radius:determineRadius } }),
                "temporary":new OpenLayers.Style({
                    pointRadius:"${radius}",
                    fillColor:"#FF6600",
                    strokeColor:"#FF6600",
                    strokeWidth:2,
                    strokeDashstyle:'dot',
                    strokeOpacity:0.75,
                    fillOpacity:0.5,
                    graphicZIndex:1
                }, { context:{ radius:determineRadius } }),

                "highlight":new OpenLayers.Style({
                    pointRadius:"${radius}",
                    fillColor:"#0015FF",
                    strokeColor:"#333",
                    strokeWidth:4,
                    fillOpacity:0.7,
                    graphicZIndex:1
                }, { context:{ radius:determineRadius } }),

                "select":new OpenLayers.Style({
                    fillColor:"#66ccff",
                    strokeColor:"#FF0000",
                    graphicZIndex:2
                })
            });
        },

        kmlRouteStyleMap:function () {
            if (this._cachedRouteStyleMap) {
                return this._cachedRouteStyleMap;
            }

            var that = this;
            var streetFeet = 30, minimumPxWidth = 5;
            var streetMapUnits = this.convertTo(streetFeet, 'ft', this.mapUnitsForConverting);
            var determineRadius = function (f) {
                return Math.max(minimumPxWidth, that.calculateRadiusPx(that.map, streetMapUnits));
            };

            var smallStreetFeet = 15, minimumSmallWidthPx = 2;
            var streetMapUnitsSmall = this.convertTo(smallStreetFeet, 'ft', this.mapUnitsForConverting);
            var determineRadiusSmall = function (f) {
                return Math.max(minimumSmallWidthPx, that.calculateRadiusPx(that.map, streetMapUnitsSmall));
            };

//            console.debug("converted value is ", that.bufferMapUnits);

            var result = new OpenLayers.StyleMap({
                "default":new OpenLayers.Style({
                        fillColor:"#ffcc66",
                        strokeColor:"#FFF", //near-white
                        strokeWidth:"${radius}", //tied to 'streetFeet'
                        graphicZIndex:1,
                        opacity:0.2
                    },
                    {context:{ radius:determineRadiusSmall }}
                ),
                "select":new OpenLayers.Style({
                        fillColor:"#66ccff",
                        strokeColor:"#333", //near-black
                        strokeWidth:"${radius}", //tied to 'streetFeet'
                        graphicZIndex:2
                    },
                    {context:{ radius:determineRadius }}
                ),
                "highlight":new OpenLayers.Style({
                        fillColor:"#66ccff",
                        strokeColor:"#30C607", //green!!
                        strokeWidth:"${radius}", //tied to 'streetFeet'
                        graphicZIndex:2,
                        opacity:0.5
                    },
                    {context:{ radius:determineRadius }}
                )
            });

            this._cachedRouteStyleMap = result;
            return result;

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
            return this.kmlRoutes[route];
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
            //console.debug("feature bounds are ", bounds);

            bounds = this.extendBounds(bounds, this.bufferMapUnits * 4);

            //console.debug("zooming to ", bounds);
            this.map.zoomToExtent(bounds);
        },


        _lastHighlighted:{
        },

        /**
         * Assumes you know what render intent you want the old feature to revert to!
         * @param feature
         * @param resetTo
         */
        highlightFeature:function (category, routeID, feature, resetTo) {
            this.map.resetLayersZIndex();

            var last = this._lastHighlighted[category];
            if (last) {
                last.renderIntent = resetTo;
                last.layer.redraw();
                this._lastHighlighted[category] = null;
            }

            this._lastHighlighted[category] = feature;

            feature.renderIntent = "highlight";
            feature.layer.setZIndex(this.routeZIndex);
            feature.layer.redraw();


            //fix the marker z-index
            if (routeID && this.liveRoutes[routeID]) {
                this.liveRoutes[routeID].setZIndex(this.markerZIndex);     //these should be above the routes.
                this.liveRoutes[routeID].redraw();
            }
        },


        liveRoutes:{
        },
        clearAllLiveRoutes:function () {
            if (this.liveRoutes) {
                for (var id in this.liveRoutes) {
                    var layer = this.liveRoutes[id];
                    if (layer) {
                        this.map.removeLayer(layer);
                        this.liveRoutes[id] = null;
                    }
                    delete this.liveRoutes[id];
                }
            }
        },
        clearAllRouteStops:function () {
            for (var id in this.routeStopsLayers) {
                var layer = this.routeStopsLayers[id];
                if (layer) {
                    this.map.removeLayer(layer);
                }
            }
            this.routeStopsLayers = {};

        },

        toggleLiveRoute:function (routeID, active) {
            if (!active) {
                //console.debug('removing layer');
                var layer = this.liveRoutes[routeID];
                if (layer) {
                    this.map.removeLayer(layer);
                    this.liveRoutes[routeID] = null;
                }
            }
            else {
                //console.debug('requesting route layer for ' + routeID);
                $.ajax({
                    url:"http://www3.septa.org/hackathon/TransitView/?route=" + routeID,
                    dataType:"jsonp",
                    success:$.proxy(function (data) {
                        //console.debug("live route loaded for " + routeID);
                        this.onLiveRouteLoaded(routeID, data);

                    }, this)
                });
            }
        },

        createBusMarker:function (bus) {

            //BlockID"3128"
            //Direction"NorthBound"
            //Offset"8"
            //VehicleID"5667"
            //destination"Chestnut Hill"
            //label"5667"
            //lat"39.993626"
            //lng"-75.147606"

            var icon = null;
            var direction = bus['Direction'];
            var iconName = 'img/glyphicons_031_bus.png';
            //console.debug('bus direction was ', direction);

            if (direction == 'NorthBound') {
                iconName = 'img/glyphicons_218_circle_arrow_top.png';
            }
            else if (direction == 'SouthBound') {
                iconName = 'img/glyphicons_219_circle_arrow_down.png';

            } else if (direction == 'EastBound') {
                iconName = 'img/glyphicons_217_circle_arrow_right.png';

            } else if (direction == 'WestBound') {
                iconName = 'img/glyphicons_216_circle_arrow_left.png';
            }
            else {
                console.debug('bus direction was ', direction);
            }
            icon = new OpenLayers.Icon(iconName, size, offset);

            var size = new OpenLayers.Size(26, 26);
//            var offset = new OpenLayers.Pixel(-(size.w / 2), -size.h);
            var offset = new OpenLayers.Pixel(-(size.w / 2), -(size.h / 2 ));
            //TODO: Change icon / cache icon?
            //var icon = new OpenLayers.Icon('http://www.openlayers.org/dev/img/marker.png', size, offset);

            var marker = new OpenLayers.Marker(new OpenLayers.LonLat(parseFloat(bus.lng), parseFloat(bus.lat)), icon);

            return marker;
        },

        createStopMarker:function (bus) {
            var size = new OpenLayers.Size(26, 26);
            var offset = new OpenLayers.Pixel(-(size.w / 2), -size.h);
            //var offset = new OpenLayers.Pixel(-(size.w / 2), -(size.h / 2 ));

            var icon = new OpenLayers.Icon('http://www.openlayers.org/dev/img/marker.png', size, offset);
            var marker = new OpenLayers.Marker(new OpenLayers.LonLat(parseFloat(bus.lng), parseFloat(bus.lat)), icon);

            return marker;
        },

        onLiveRouteLoaded:function (routeID, data) {
//            console.debug('got back ', routeID, data);

            if (data && (data.bus)) {

                var layer = new OpenLayers.Layer.Markers(routeID);
                this.liveRoutes[routeID] = layer;
                this.map.addLayer(layer);
                layer.setZIndex(this.markerZIndex);     //these should be above the routes.

                for (var id in data.bus) {
                    var bus = data.bus[id];
//                    console.debug('got back bus ', bus);

                    layer.addMarker(this.createBusMarker(bus));
                }
            }

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
        padLeft:function (str, chr, num) {
            str = str + '';
            while (str.length < num) {
                str = chr + str;
            }
            return str;
        },

        getRouteScheduleURL:function (id) {
            var baseURL = "http://www.septa.org/schedules/bus/pdf/";
            var routeNum = parseFloat(id);
            if (isNaN(routeNum)) {
                return 'http://www.septa.org/schedules/';
            }
            var paddedNum = this.padLeft(routeNum, '0', 3);
            return baseURL + paddedNum + ".pdf";
        },

        toggleRouteStops:function (id, feature, wasActive) {
            if (wasActive) {
                if (this.routeStopsLayers[id]) {
                    var layer = this.routeStopsLayers[id];
                    if (layer) {
                        this.map.removeLayer(layer);
                        this.routeStopsLayers[id] = null;
                        delete this.routeStopsLayers[id];
                    }
                }
            }
            else {
                $.ajax({
                    url:"http://www3.septa.org/hackathon/Stops/?req1=" + id,
                    dataType:"jsonp",
                    success:$.proxy(function (data) {
                        this.onRouteStopsLoaded(id, data, feature);
                    }, this)
                });

            }
        },

        routeStopsLayers:{}, //TODO: Clear
        onRouteStopsLoaded:function (id, data, feature) {
            if (this.routeStopsLayers[id]) {
                this.map.removeLayer(this.routeStopsLayers[id]);
                delete this.routeStopsLayers[id];
            }

            var layer = new OpenLayers.Layer.Markers("Stops_" + id);
            this.routeStopsLayers[id] = layer;
            this.map.addLayer(layer);
            layer.setZIndex(this.markerZIndex);


            var distanceThreshold = this.bufferMapUnits * 2;
            var inRange = function (src, dest) {
                var dist = 0;
                if (!src.geometry) {
                    dist = src.distanceTo(dest.geometry)
                }
                else {
                    dist = src.geometry.distanceTo(dest.geometry);
                }
                //console.debug(src, dest, ' distance was ', dist);
                return (dist <= distanceThreshold)
            };

            for (var idx in data) {
                var stop = data[idx];

                var geom = new OpenLayers.Geometry.Point(parseFloat(stop.lng), parseFloat(stop.lat));
                //console.debug('geom in range of feature? ', geom, feature);
                if (inRange(geom, feature)) {

                    var marker = this.createStopMarker(stop);
                    layer.addMarker(marker);
                }
            }

        },


        _nextAccordionGroupID:1,

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
            var $root = $("#routeAccordion");
            var map = this.map;

            var collapseGroupID = "collapse_" + this._nextAccordionGroupID++;

            var orig = "" +
                "<div class='accordion-group routeQueryWidget'>" +
                "    <div class='accordion-heading'>" +

                "            <!--TITLE SECTION HERE-->" +
                "            <button class='btn btn-info reverseAddressBtn'><i class='icon-zoom-in'></i> " +
                "              <span class='reverseAddress'>Routes near (checking...) </span>" +
                "              <span class='badge routeCount'>" + items.length + " <i class=' icon-tasks'></i></span>" +
                "            </button>" +
                "        <span data-toggle='collapse' data-parent='#routeAccordion' href='#" + collapseGroupID + "'>" +
                "            <button class='btn collapseBtn'> <i class='icon-minus'></i> </button> " +
                "        </span>" +
                "    </div>" +
                "    <div id='" + collapseGroupID + "' class='accordion-body collapse'>" +
                "        <div class='accordion-inner'> <!--BODY SECTION HERE-->" +
                "            <ul class='routeList' ></ul>" +
                "        </div>" +
                "    </div>" +
                "</div>";


            //better way to create and append a div, while retaining a reference to it?
            var $node = $(orig);
            $($node).appendTo($root);
            var $list = $($node).find(".routeList");
            $("#" + collapseGroupID).collapse('toggle');


            var $collapseBtn = $($node).find('.collapseBtn');
//            var $collapsibleRegion = $($node).find('.collapse');
            $collapseBtn.on('click', function () {
                var hidden = $collapseBtn.find('i').hasClass('icon-minus');
                $collapseBtn.find('i').toggleClass('icon-plus', hidden);
                $collapseBtn.find('i').toggleClass('icon-minus', !hidden);
                //$collapsibleRegion.collapse(hidden ? 'show' : 'hide');
            });

            //data-toggle='collapse' data-target='ul.collapse'

            var onAddressResolved = $.proxy(function (addresses) {
                if (!addresses) {
                    console.error("No addresses returned!");
                }

                var first = addresses.address;//[0];

                $($node).find('.reverseAddress').html(first.Address);
                $($node).find('.reverseAddressBtn').on('click', $.proxy(function () {
                    this.panZoomAroundQuery(feature);
                }, this));

                //on mouseover addresse button, highlight feature
                var highlightFn = $.proxy(this.highlightFeature, this);
                $($node).find('.reverseAddressBtn').on("mouseover", function () {
                    highlightFn("search", null, feature, "default");
                });

            }, this);
            this.resolvePointToAddress(feature, onAddressResolved);


            if (!items || (items.length == 0)) {
                var h = "<divNo routes found nearby</div>";
                $(h).appendTo($list);
            }
            else {
                var rowNum = 0;

                for (var id in items) {
                    var route = items[id];

                    var routeID = route.layer.name;
                    var name = route.feature.attributes.name;
                    var routeName = '';
                    if (this.routeNames) {
                        var routeInfo = this.routeNames[routeID];
                        routeName = (routeInfo) ? routeInfo.name : '';
                    }

                    var evenOdd = (rowNum % 2 == 0) ? "even" : "odd";
                    rowNum++;

                    var h = "" +
                        "<div class='route " + evenOdd + "'>" +
                        " <div class='section'> " +
                        "  <div class='title'>" +
                        "   <h3 class='short_name'>" + name + "" +
                        "     <small class='long_name'>" + routeName + "</small>" +
                        "   </h3>" +
                        "  </div>" +

                        "   <div class='controls'>" +
                        "    " +
                        "  <div class='btn-group'>" +
                        "     <button class='btn btn-medium btn-info  zoom'><i class='icon-zoom-in'></i> Zoom</button>" +
                        "     <button class='btn btn-medium buses '><i class='icon-eye-open'></i> Buses</button>" +
                        "     <button class='btn btn-medium schedule'><i class='icon-time'></i> Schedule</button>" +
                        "     <button class='btn btn-medium stops'><i class='icon-time'></i> Stops</button>" +
                        "  </div>" +
                        " </div>" +
                        " </div>" +
                        "</div>";


                    var $h = $(h);
                    $h.appendTo($list);

                    var highlightFn = $.proxy(this.highlightFeature, this),
                        toggleRouteFn = $.proxy(this.toggleLiveRoute, this),
                        getScheduleURLFn = $.proxy(this.getRouteScheduleURL, this),
                        toggleStopsFn = $.proxy(this.toggleRouteStops, this)
                        ;


                    (function (item, busRouteID) {
                        var activeClass = 'btn-success';

                        $($h).find(".zoom").on("click", function () {
                            //console.debug('zooming to item ', item.feature.attributes.name);
                            highlightFn("route", busRouteID, item.feature, "select");
                            map.zoomToExtent(item.feature.geometry.getBounds());
                        });
                        $($h).find(".buses").on("click", function () {
                            var isActive = $(this).hasClass(activeClass);
                            toggleRouteFn(busRouteID, !isActive);
                            $(this).toggleClass(activeClass, !isActive);
                        });

                        $($h).find(".schedule").on("click", function () {
                            //http://www.septa.org/schedules/bus/pdf/090.pdf
                            var url = getScheduleURLFn(busRouteID);
                            window.open(url, '_blank')
                        });
                        $($h).find(".stops").on("click", function () {
                            var isActive = $(this).hasClass(activeClass);
                            toggleStopsFn(busRouteID, feature, isActive);
                            $(this).toggleClass(activeClass, !isActive);
                        });


                        $($h).on("mouseover", function () {
                            highlightFn("route", busRouteID, item.feature, "select");
                        });
                    })(route, routeID);

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
