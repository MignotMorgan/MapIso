import { Factory } from 'Control/factory.js';
import { MapView, DrawMapView, MouseIso, ResizeIso, ScaleIso } from './mapView.js';
import { CaseIso } from './caseIso.js';
import { Entity } from './entityIso.js';

export class FactoryMapView extends Factory {  
    createControl(){ return new MapView(); }
    createFactoryElement(){ return new FactoryElementIso(); }
    createDraw(control){ return new DrawMapView(control); }
    createMouse(control){ return new MouseIso(control); }
    createResize(control){ return new ResizeIso(control); }
    createScale(control){ return new ScaleIso(control); }
}

/** Crée les objets monde (cases, entités), pas les contrôles UI. */
export class FactoryElementIso{
    constructor(){}
    createCase(x, y){ return new CaseIso(x, y); }
    /** options : id, width, canMove, body… (camelCase ou JSON PascalCase). */
    createEntity(x, y, z, options){ return new Entity(x, y, z, options); }
}
