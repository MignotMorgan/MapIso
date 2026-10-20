import { Factory } from 'Control/factory.js';
import { MapView } from '../mapView.js';
import { DrawMapView } from './drawMapView.js';
import { MouseMapView } from './mouseMapView.js';
import { ResizeMapView } from './resizeMapView.js';
import { ScaleMapView } from './scaleMapView.js';

export class FactoryMapView extends Factory {  
    createControl(){ return new MapView(); }
    createDraw(control){ return new DrawMapView(control); }
    createMouse(control){ return new MouseMapView(control); }
    createResize(control){ return new ResizeMapView(control); }
    createScale(control){ return new ScaleMapView(control); }
}
