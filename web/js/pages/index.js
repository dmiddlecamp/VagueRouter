(function () {
    VR.Pages = VR.Pages || {};

    var IndexConstructor = function () {
    };
    IndexConstructor.prototype = {
        startingExtent: new OpenLayers.Bounds(-75.442428588868,39.783554077149,-74.893112182618,40.195541381837),

        startup:function () {
            console.debug("Hello World!");

            this.setupMap();

            console.debug("Page done loading...");
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

            //map.setCenter(new OpenLayers.LonLat(0, 0), 1);


            this.map = map;
        },


        foo:'bar'
    };

    $(function() {
        VR.Pages.index = new IndexConstructor();
        VR.Pages.index.startup();
    });

})();
