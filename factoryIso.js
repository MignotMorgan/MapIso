import { Factory } from 'Control/factory.js';
import { MapView, DrawMapView, MouseIso, ResizeIso, ScaleIso } from './mapView.js';
import { CaseIso } from './caseIso.js';
import { Cube } from './cubeIso.js';
import { Entity } from './entityIso.js';
import { WorldMap } from './worldMap.js';

export class FactoryMapView extends Factory {  
    createControl(){ return new MapView(); }
    createFactoryElement(){ return new FactoryElementIso(); }
    createDraw(control){ return new DrawMapView(control); }
    createMouse(control){ return new MouseIso(control); }
    createResize(control){ return new ResizeIso(control); }
    createScale(control){ return new ScaleIso(control); }
}

/** Crée les objets monde (carte, cubes, entités, cases), pas les contrôles UI. */
export class FactoryElementIso{
    constructor(){}
    createCase(x, y){ return new CaseIso(x, y); }
    /** options : floors, volumes, cross… (camelCase ou JSON PascalCase). */
    createCube(x, y, z, options){ return new Cube(x, y, z, options); }
    /** options : id, width, canMove, body… (camelCase ou JSON PascalCase). */
    createEntity(x, y, z, options){ return new Entity(x, y, z, options); }
    /** Carte vide aux dimensions données. options : name, cubes, permanents, entitys, noCeiling. */
    createMap(width, height, depth, options){ return new WorldMap(width, height, depth, options); }
    /** Carte reconstruite depuis du JSON (sauvegarde éditeur ou message serveur). */
    loadMap(json){ return WorldMap.from(json); }
}
