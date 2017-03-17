/* global MissionIntelApp */
MissionIntelApp.Map = function(app) {

    /* GLOBAL FUNCTIONS */
    this.toggleLayer = function(layerName) {
        toggleLayer(layerName);
    };


    /* LOCAL FUNCTIONS */
    function toggleLayer(layerName) {
        layerName.setVisible((!layerName.getVisible()));
    }

    function get(el) {
        if (typeof el == 'string') return document.getElementById(el);
        return el;
    }

    function findProjectedRadius(center, radius) {
        var edgeCoord = [center[0] + radius, center[1]];
        var wgs84Sphere = new ol.Sphere(6378137);
        var groundRadius = wgs84Sphere.haversineDistance(ol.proj.transform(center, 'EPSG:3857', 'EPSG:4326'), ol.proj.transform(edgeCoord, 'EPSG:3857', 'EPSG:4326'));

        return groundRadius;
    }

    function addMarkersToLayerBySource(source, lookup, layer) {
        if (!layer.getSource()) {
            layer.setSource(new ol.source.Vector());
        }

        source.forEachFeature(function(f) {
            if (f.getProperties().source == lookup) {
                var mysymbol = new MS.symbol(
                    f.getProperties().SIDC, {
                        size: iconSize[(f.getProperties().SIDC).charAt(11)],
                        uniqueDesignation: f.getProperties().name
                    }
                );

                var mycanvas = mysymbol.getMarker().asCanvas();

                f.setStyle(new ol.style.Style({
                    image: new ol.style.Icon(({
                        scale: 1,
                        anchor: [mysymbol.markerAnchor.x, mysymbol.markerAnchor.y],
                        anchorXUnits: 'pixels',
                        anchorYUnits: 'pixels',
                        imgSize: [Math.floor(mysymbol.width), Math.floor(mysymbol.height)],
                        img: (mycanvas)
                    }))
                }));
                layer.getSource().addFeature(f);
            }
        });
    }

    function drawInteraction(source, brush) {
        if (brush !== 'None') {
            draw = new ol.interaction.Draw({
                source: source,
                type: /** @type {ol.geom.GeometryType} */ (brush),
            });

            map.addInteraction(draw);
        }
    }

    function getObjectID(object) {

        // Dersom den globale variabelen "_objectIDs" ikkje fins
        if (window._objectIDs === undefined)
            // Lag den og sett den til 0
            window._objectIDs = 0;

        // Dersom dette objektet ikkje har en attribut "_objectID"
        if (object._objectID === undefined) {
            // Legg til attributen, sett den til å være antallet objectIDs (globale variabelen)
            object._objectID = window._objectIDs;
            // Inkrementèr antall objectIDs
            window._objectIDs++;
        }

        // Returner IDen til objektet (som vi kanskje lagde over)
        return object._objectID;
    }

    /* GLOBALS */
    var draw;
    var iconSize = {
        "C": 15,
        "D": 20,
        "E": 25,
        "F": 30,
        "G": 35,
        "H": 40,
        "I": 45
    };



    /* SOURCES */
    var dcsSource = new ol.source.Vector({
        features: (new ol.format.GeoJSON()).readFeatures(dcsStream, {
            featureProjection: 'EPSG:3857'
        })
    });

    var drawSource = new ol.source.Vector({
        wrapX: false
    });

    var vectorSource = new ol.source.Vector({
        loader: function() {
            var url = 'src/vectors/vectors.geojson';
            var source = this;

            app.getJSON(url, '', function(r) {

                if (Object.keys(r).length > 0) {
                    var f = (new ol.format.GeoJSON()).readFeatures(r, {
                        featureProjection: 'EPSG:3857'
                    });
                    source.addFeatures(f);
                }

                // Replace all features of type Point with a Circle feature in stead.
                source.forEachFeature(function(f) {

                    if (f.getGeometry().getType() == 'Point') {

                        var circle = new ol.geom.Circle(f.getGeometry().getCoordinates(), 1);
                        circle.setRadius(findProjectedRadius(circle.getCenter(), f.getProperties().radius));

                        var circleFeature = new ol.Feature(circle);

                        circleFeature.setProperties({
                            name: f.getProperties().name,
                            type: f.getProperties().type
                        });

                        var style = new ol.style.Style({
                            stroke: new ol.style.Stroke({
                                color: f.getProperties().color,
                                width: 1
                            }),
                            fill: new ol.style.Fill({
                                color: f.getProperties().colorBg
                            })
                        });

                        circleFeature.setStyle(style);

                        source.addFeature(circleFeature);
                        source.removeFeature(f);
                    }

                    if (f.getGeometry().getType() == 'Polygon') {
                        //console.log(f.getGeometry().getCoordinates());
                        var style = new ol.style.Style({
                            stroke: new ol.style.Stroke({
                                //color: 'blue',
                                color: f.getProperties().color,
                                width: 1
                            }),
                            fill: new ol.style.Fill({
                                //color: 'rgba(0, 0, 255, 0.1)'
                                color: f.getProperties().colorBg
                            })
                        });

                        f.setStyle(style);
                    }
                });
            });
        }
    });

    /* STYLES */
    var defaultStyle = new ol.style.Style({
        stroke: new ol.style.Stroke({
            color: 'rgba(255,0,0,0.5)',
            width: 1
        })
    });

    var selectStyle = new ol.style.Style({
        stroke: new ol.style.Stroke({
            color: 'rgba(95,95,95,1)',
            width: 2
        }),
        fill: new ol.style.Fill({
            color: 'rgba(95,95,95,0.1)'
        }),
    });

    /* LAYERS SETUP */
    var vectorLayer = new ol.layer.Vector({ // "Note that any property set in the options is set as a ol.Object property on the layer object; for example, setting title: 'My Title' in the options means that title is observable, and has get/set accessors."
        id: 'vectors',
        source: vectorSource
    });

    var plannedLayer = new ol.layer.Vector({
        id: 'planned'
    });

    var awacsLayer = new ol.layer.Vector({
        id: 'awacs'
    });

    var drawLayer = new ol.layer.Vector({
        id: 'draw',
        source: drawSource
    });

    var mapLayer = new ol.layer.Tile({
        id: 'map',
        preload: 4,
        source: new ol.source.TileJSON({
            url: 'http://api.tiles.mapbox.com/v4/mapbox.dark.json?access_token=pk.eyJ1Ijoic2d0dGVkIiwiYSI6ImNpdWZ1bmZ0OTAwMWoyem5uaGl4a2s0ejIifQ.aqtpdqUySGs1lrPbtITp0g',
            crossOrigin: 'anonymous'
        })
    });

    addMarkersToLayerBySource(dcsSource, 'planned', plannedLayer);
    addMarkersToLayerBySource(dcsSource, 'awacs', awacsLayer);
    // addMarkersToLayerBySource(dcsSource, 'planned', new ol.layer.Vector({
    //     id: 'planned'
    // }));

    /* CONTROLS SETUP */
    // var mousePositionControl = new ol.control.MousePosition({
    //     coordinateFormat: ol.coordinate.createStringXY(4),
    //     projection: 'EPSG:4326'
    // });

    var mousePositionControl = new ol.control.MousePosition({
        coordinateFormat: function(coord) {
          return ol.coordinate.toStringHDMS(coord, 3);
        },
        projection: 'EPSG:4326'
    });

    var scaleLineControl = new ol.control.ScaleLine();

    /* VIEW SETUP */
    var center = ol.proj.transform([42.000, 42.000], 'EPSG:4326', 'EPSG:3857');

    var view = new ol.View({
        center: center,
        zoom: 8
    });

    /* MAP SETUP */
    var map = new ol.Map({
        target: 'div-map',
        controls: ol.control.defaults({
            attributionOptions: /** @type {olx.control.AttributionOptions} */ ({
                collapsible: true
            })
        }).extend([mousePositionControl, scaleLineControl]),
        view: view,
    });

    map.addLayer(mapLayer);
    map.addLayer(vectorLayer);
    map.addLayer(drawLayer);
    map.addLayer(plannedLayer);
    map.addLayer(awacsLayer);


    /* EVENTS */
    document.getElementById("map-filters-awacs").onclick = function(element) {
        document.getElementById("map-filters-awacs").classList.toggle("enabled-map-function");
        document.getElementById("map-filters-awacs").classList.toggle("disabled-map-function");
        toggleLayer(awacsLayer);
    };

    document.getElementById("map-filters-planned").onclick = function(element) {
        document.getElementById("map-filters-planned").classList.toggle("enabled-map-function");
        document.getElementById("map-filters-planned").classList.toggle("disabled-map-function");
        toggleLayer(plannedLayer);
    };

    document.getElementById("map-draw-brush-type").onchange = function() {
        map.removeInteraction(draw);
        drawInteraction(drawSource, this.value);
    };

    drawInteraction(drawSource, document.getElementById("map-draw-brush-type").value);

    drawSource.on('addfeature', function(e) {
        // add controls for deleting and manipulating all features in the source
        var container = document.getElementById("map-draw-features");
        while (container.firstChild) {
            container.removeChild(container.firstChild);
        }
        var containerLastChild = container.lastChild;

        drawSource.forEachFeature(function(f) {
            var objectID = getObjectID(f);
            var node = document.createElement("LI");


            if (!f.getProperties().name) {
                f.setProperties({
                    name: f.getGeometry().getType(),
                }, true);
            }

            node.className = 'enabled-map-function';
            node.innerHTML = "<i class='icon-block' /></i><i class='icon-cog'></i><i class='icon-user-plus'></i><textarea id='map-draw-feature-namebox'>" + f.getProperties().name + "</textarea></li>";

            // TODO Add code for options-menu, based on type of feature
            var geometryCoords = ol.proj.toLonLat(f.getGeometry().getCoordinates());
            var inputCoords;

            console.log(f.getGeometry().getCoordinates());

            if (f.getGeometry().getType() == 'Point') {
                // var coordX = f.getGeometry().getFirstCoordinate();
                // var coordY = f.getGeometry().getLastCoordinate();
                //console.log(ol.proj.toLonLat(coordX));
                node.innerHTML = node.innerHTML + "<div id='map-draw-opt-actions' class='opt-actions'><ul>\
                                                    <li class='opt opt-color'>COLOR:</li>\
                                                    <li class='opt opt-color'><textarea></textarea></li>\
                                                    <li class='opt opt-fillcolor'>FILL COLOR</li>\
                                                    <li class='opt opt-fillcolor'><textarea></textarea></li>\
                                                    <li class='opt opt-coord'>COORDS:</li>\
                                                    <li class='opt opt-coord-input opt-coord'><textarea class='opt-coord-inputx'>" + geometryCoords[0].toFixed(7) + "</textarea><textarea class='opt-coord-inputy'>" + geometryCoords[1].toFixed(7) + "</textarea></li>\
                                                    </ul></div>";

                // var circle = new ol.geom.Circle(f.getGeometry().getCoordinates(), 1);
                // circle.setRadius(findProjectedRadius(circle.getCenter(), f.getProperties().radius));
            }

            if (f.getGeometry().getType() == 'Circle') {
                node.innerHTML = node.innerHTML + "<div id='map-draw-opt-actions' class='opt-actions'><ul>\
                                                  <li class='opt opt-color'>COLOR:</li>\
                                                  <li class='opt opt-color'><textarea></textarea></li>\
                                                  <li class='opt opt-fillcolor'>FILL COLOR></li>\
                                                  <li class='opt opt-fillcolor'><textarea></textarea></li>\
                                                  <li class='opt opt-radius'>RADIUS:</li>\
                                                  <li class='opt opt-radius'><textarea></textarea></li>\
                                                  <li class='opt opt-coord'>CENTER:</li>\
                                                  <li class='opt opt-coord-center opt-coord'><textarea>" + geometryCoords[0].toFixed(7) + "</textarea><textarea>" + geometryCoords[1].toFixed(7) + "</textarea></li>\
                                                  </ul></div>";
            }

            if (f.getGeometry().getType() == 'Polygon') {
                //node.innerHTML = node.innerHTML + "SOME HTML HERE!"

                // IDEA the coords variable will most likely return a longer array of coords for polys and lineStrings and so will probably need to iterate trough the whole array - outputting textareas.
                // IDEA On polys and lineStrings - each coordinate pair needs to be deletable
            }

            container.appendChild(node);

            // add events pr feature
            node.querySelector('[id="map-draw-feature-namebox"]').onblur = function() {
                f.setProperties({
                    name: this.value,
                }, true);
            }

            node.querySelector(".icon-block").onclick = function() {
                drawSource.removeFeature(f);
                node.parentNode.removeChild(node);
            }

            node.querySelector(".icon-cog").onclick = function() {
                node.querySelector(".opt-actions").classList.toggle("opt-actions-active");

                // update position
                inputCoords = [parseFloat(node.querySelector(".opt-coord-inputx").value), parseFloat(node.querySelector(".opt-coord-inputy").value)];
                inputCoords = ol.proj.fromLonLat(inputCoords);
                f.getGeometry().setCoordinates(inputCoords);

                // TODO update color information
            }

            node.querySelector(".icon-user-plus").onclick = function() {
                this.classList.toggle("icon-user-plus-active");
                // TODO this gets disabled when the list re-renders. Probably a status property will have to be added to f and checked
            }

            //console.log(f._objectID);

        })

        // IDEA Create JSON string and store on computer
    });

    // var geo = (new ol.format.GeoJSON).writeFeatures(vectorLayer.getSource().getFeatures());
    // console.log(geo);

    // vectorSource.on('change', function(e) {
    //   console.log('change!');
    // });

};