import { Case } from './case.js';
import { Cube } from './cube.js';
import { Entity } from './entity.js';
import { WorldMap } from './worldMap.js';

/** Crée les objets monde (carte, cubes, entités, cases), pas les contrôles UI. */
export class FactoryWorld{
    constructor(){}
    createCase(x, y){ return new Case(x, y); }
    /** options : floors, volumes, cross… */
    createCube(x, y, z, options){ return new Cube(x, y, z, options); }
    /** options : id, width, canMove, body… */
    createEntity(x, y, z, options){ return new Entity(x, y, z, options); }
    /** Carte vide aux dimensions données. options : name, cubes, permanents, entities, noCeilingZones. */
    createWorldMap(width, height, depth, options){ return new WorldMap(width, height, depth, options); }
    /** Carte reconstruite depuis du JSON (sauvegarde éditeur ou message serveur). */
    loadWorldMap(json){ return WorldMap.from(json); }
}
