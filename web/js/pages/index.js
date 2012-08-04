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


            var vectors = new OpenLayers.Layer.Vector("Vector Layer");

            map.addLayers([wms, vectors]);
            map.addControl(new OpenLayers.Control.MousePosition());
//            map.addControl(new OpenLayers.Control.EditingToolbar(vectors));

//            var selectOptions = {
//                hover:true,
//                onSelect:function() { console.debug('selected'); }
//            };
//            var select = new OpenLayers.Control.SelectFeature(vectors, selectOptions);
//            map.addControl(select);
//            select.activate();

//            updateFormats();

            map.zoomToExtent(this.startingExtent);

            //TODO: draw feature control
            map.events.register("click", map, $.proxy(this.onMapClicked, this));

            //map.setCenter(new OpenLayers.LonLat(0, 0), 1);
            this.map = map;

            this.loadAllRoutes();

            //this.addRoute(3);
            //this.addRoute(5);
           //this.addRoute(10);


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


        kmlRoutes:{},
        addRoute:function (route) {

            if (!this.kmlRoutes[route]) {
                this.kmlRoutes[route] = new OpenLayers.Layer.Vector("KML", {
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


        onMapClicked:function (e) {
            var layerPx = this.map.getLayerPxFromViewPortPx(e.xy);
            var lonLat = this.map.getLonLatFromLayerPx(layerPx);
            console.debug('map clicked ', lonLat);

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
