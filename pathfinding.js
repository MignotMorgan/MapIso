import { Location } from './point.js';
import { Direction } from './entityMove.js';

/**
 * Un nœud de recherche : un cube atteint, plus le nœud d'où l'on vient.
 *
 * On ne stocke pas le chemin complet dans chaque nœud (c'était le cas avant, et
 * recopier le trajet à chaque case coûtait très cher) : on garde seulement le
 * parent, et on reconstruit le chemin une seule fois, à la fin, avec path().
 */
export class PathNode{

    #x = 0;
    #y = 0;
    #z = 0;
    #parent = null;
    #distance = 0;

    constructor(x, y, z, parent = null){
        this.#x = x;
        this.#y = y;
        this.#z = z;
        this.#parent = parent;
        this.#distance = parent === null ? 0 : parent.distance + 1;
    }

    get x(){ return this.#x; }
    get y(){ return this.#y; }
    get z(){ return this.#z; }
    get parent(){ return this.#parent; }
    /** Nombre de pas depuis le départ. Sert à limiter la portée de la recherche. */
    get distance(){ return this.#distance; }

    /** Remonte les parents et renvoie le trajet complet, du départ jusqu'ici. */
    path(){
        const path = [];
        let node = this;
        while(node !== null){
            path[path.length] = new Location(node.x, node.y, node.z);
            node = node.parent;
        }
        return path.reverse();
    }
}

/**
 * Recherche de chemin en 3D, de proche en proche (parcours en largeur).
 *
 * Chaque case a 26 voisins : 8 au même niveau, 9 au-dessus, 9 en dessous.
 * On explore par cercles concentriques, donc le premier chemin trouvé est
 * toujours le plus court en nombre de pas.
 *
 * Usage : new Pathfinding(x, y, z, worldMap).moveTo(entity, destX, destY, destZ)
 * Le trajet est écrit dans entity.entityMove.path.
 *
 * worldMap doit exposer cubeAt(x, y, z) — c'est tout. Le moteur ignore donc
 * comment la carte range ses cubes, ce qui la rend remplaçable (une carte
 * unique aujourd'hui, un assemblage de cartes plus tard).
 */
export class Pathfinding{

    // Les 26 offsets, calculés une seule fois pour toutes les recherches.
    static #offsets = null;

    #x = 0;
    #y = 0;
    #z = 0;
    #worldMap = null;
    //maxDistance : portée en nombre de pas. Sans limite, une carte immense gèlerait le jeu.
    #maxDistance = 48;
    //maxNodes : garde-fou absolu sur le nombre de cases explorées.
    #maxNodes = 20000;
    //pathNodes : tous les nœuds visités, dans l'ordre de découverte.
    #pathNodes = [];
    //visited : index des cases déjà vues, pour ne jamais repasser au même endroit.
    #visited = new Set();

    constructor(x, y, z, worldMap, options = {}){
        this.#x = x;
        this.#y = y;
        this.#z = z;
        this.#worldMap = worldMap ?? null;
        this.#maxDistance = options.maxDistance ?? 48;
        this.#maxNodes = options.maxNodes ?? 20000;
    }

    get x(){ return this.#x; }
    get y(){ return this.#y; }
    get z(){ return this.#z; }
    get worldMap(){ return this.#worldMap; }
    set worldMap(value){ this.#worldMap = value ?? null; }
    get maxDistance(){ return this.#maxDistance; }
    set maxDistance(value){ this.#maxDistance = value ?? 48; }
    get maxNodes(){ return this.#maxNodes; }
    set maxNodes(value){ this.#maxNodes = value ?? 20000; }
    get pathNodes(){ return this.#pathNodes; }

    /** Cube du monde. On demande à la carte, on ne fouille jamais sa grille nous-même. */
    findCube(wx, wy, wz){
        if(this.#worldMap === null) return null;
        return this.#worldMap.cubeAt(wx, wy, wz);
    }

    /** Cette case a-t-elle déjà été explorée ? Réponse immédiate, quelle que soit la taille du monde. */
    visited(wx, wy, wz){
        return this.#visited.has(Pathfinding.#key(wx, wy, wz));
    }

    /**
     * Explore jusqu'à atteindre (x,y,z), et s'arrête dès qu'on l'a trouvée.
     * Renvoie le nœud d'arrivée, ou null si la case est hors de portée / inaccessible.
     */
    search(wx, wy, wz, entity = null){
        this.#pathNodes = [];
        this.#visited = new Set();

        if(entity !== null && !entity.canMove) return null;

        const start = new PathNode(this.#x, this.#y, this.#z);
        this.#pathNodes[0] = start;
        this.#visited.add(Pathfinding.#key(start.x, start.y, start.z));
        if(start.x === wx && start.y === wy && start.z === wz) return start;

        const offsets = Pathfinding.offsets();

        // File d'attente : on avance avec un curseur au lieu de retirer le premier
        // élément, et surtout sans récursion (une carte immense ferait déborder la pile).
        for(let head = 0; head < this.#pathNodes.length; head++)
        {
            const node = this.#pathNodes[head];
            if(node.distance >= this.#maxDistance) continue;

            for(let i = 0; i < offsets.length; i++)
            {
                const offset = offsets[i];
                const nx = node.x + offset.x;
                const ny = node.y + offset.y;
                const nz = node.z + offset.z;

                const key = Pathfinding.#key(nx, ny, nz);
                if(this.#visited.has(key)) continue;

                const from = this.findCube(node.x, node.y, node.z);
                const cube = this.findCube(nx, ny, nz);
                const cross = new Cross(from, cube, (x, y, z) => this.findCube(x, y, z));
                if(!cross.crossable()) continue;

                this.#visited.add(key);
                const next = new PathNode(cube.x, cube.y, cube.z, node);
                this.#pathNodes[this.#pathNodes.length] = next;

                if(next.x === wx && next.y === wy && next.z === wz) return next;
                if(this.#pathNodes.length >= this.#maxNodes) return null;
            }
        }
        return null;
    }

    /**
     * Trajet vers (x,y,z), du départ à l'arrivée.
     * Tableau d'un seul point si la destination n'est pas atteignable :
     * l'appelant doit donc vérifier la longueur avant de faire bouger quoi que ce soit.
     */
    find(wx, wy, wz, entity = null){
        const node = this.search(wx, wy, wz, entity);
        if(node === null) return [new Location(wx, wy, wz)];
        return node.path();
    }

    /**
     * Donne l'ordre de marche à une entité.
     * Renvoie false si elle ne peut pas bouger ou si la destination est inaccessible ;
     * dans ce cas rien n'est modifié, l'entité reste sur place.
     */
    moveTo(entity, wx, wy, wz){
        if(entity === null) return false;
        if(!entity.canMove) return false;
        if(entity.entityMove === null) return false;   // pas de buffer de déplacement

        const node = this.search(wx, wy, wz, entity);
        if(node === null) return false;

        return entity.walk(node.path());
    }

    /** Les 26 offsets d'une case, construits une seule fois. */
    static offsets(){
        if(this.#offsets != null) return this.#offsets;
        const offsets = [];
        for(let n = 1; n < 27; n++){
            const offset = Pathfinding.offset(n);
            if(offset.x === 0 && offset.y === 0 && offset.z === 0) continue;
            offsets[offsets.length] = offset;
        }
        this.#offsets = offsets;
        return offsets;
    }

    /**
     * n 1..26 → Location (dx, dy, dz) ∈ {-1,0,1}.
     * n%9 = plan horizontal (0 = rester, 1 N … 8 S-W).
     * n>=18 monte, 9..17 descend.
     */
    static offset(n){
        let dx = 0;
        let dy = 0;
        let dz = 0;
        const n2 = n % 9;
        switch (n2){
        case 0: { dx = 0; dy = 0; break; }
        case 1: { dx = 0; dy = -1; break; }
        case 2: { dx = 1; dy = 0; break; }
        case 3: { dx = 0; dy = 1; break; }
        case 4: { dx = -1; dy = 0; break; }
        case 5: { dx = -1; dy = -1; break; }
        case 6: { dx = 1; dy = -1; break; }
        case 7: { dx = 1; dy = 1; break; }
        case 8: { dx = -1; dy = 1; break; }
        }
        if (n >= 18) dz = 1;
        else if (n >= 9) dz = -1;
        return new Location(dx, dy, dz);
    }

    static #key(x, y, z){ return x + "," + y + "," + z; }
}

export class Cross{
    #source = null; 
    #destination = null; 
    #findCube = null; 

    constructor(source, destination, findCube = null){
        this.#source = source; 
        this.#destination = destination; 
        this.#findCube = findCube; 
    }

    get source(){ return this.#source; } 
    get destination(){ return this.#destination; } 

    #cube(x, y, z){ return this.#findCube === null ? null : this.#findCube(x, y, z); } 

    #floorOpen(x, y, z){ 
        const cube = this.#cube(x, y, z);
        return cube === null ? true : cube.floorOpen;
    }
    #northOpen(x, y, z){ 
        const cube = this.#cube(x, y, z);
        return cube === null ? true : cube.northOpen; 
    }
    #westOpen(x, y, z){ 
        const cube = this.#cube(x, y, z);
        return cube === null ? true : cube.westOpen; 
    }

    crossable(){
        /* plus tard gere les ascenseurs. */
        if(this.#source === null || this.#destination === null || !this.#destination.walkable) return false;
        const direction = Direction.between(this.#source.x, this.#source.y, this.#destination.x, this.#destination.y);

        switch (direction) {
            case Direction.NORTH:
                return this.#crossNorth();
            case Direction.WEST:
                return this.#crossWest();
            case Direction.SOUTH:
                return this.#crossSouth();
            case Direction.EAST:
                return this.#crossEast();
            case Direction.NORTH_WEST:
                return this.#crossNorthWest();
            case Direction.SOUTH_WEST:
                return this.#crossSouthWest();
            case Direction.SOUTH_EAST:
                return this.#crossSouthEast();
            case Direction.NORTH_EAST:
                return this.#crossNorthEast();
            default:
                return false;
        }
    }
    //(x, y-1)
    #crossNorth(){
        if (this.#destination.z === this.#source.z){
            if (!this.#northOpen(this.#source.x, this.#source.y, this.#source.z)) return false;
        }
        else if (this.#destination.z > this.#source.z){
            if (!this.#floorOpen(this.#source.x, this.#source.y, this.#source.z+1)) return false;
            if (!this.#northOpen(this.#source.x, this.#source.y, this.#source.z+1)) return false;
        }
        else if (this.#destination.z <this.#source.z){
            if (!this.#floorOpen(this.#source.x, this.#source.y-1, this.#source.z)) return false;
            if (!this.#northOpen(this.#source.x, this.#source.y, this.#source.z)) return false;
        }
        return true;
    }
    //(x+1, y)
    #crossEast(){
        if (this.#destination.z === this.#source.z){
            if (!this.#westOpen(this.#source.x+1, this.#source.y, this.#source.z)) return false;
        }
        else if (this.#destination.z > this.#source.z){
            if (!this.#floorOpen(this.#source.x, this.#source.y, this.#source.z+1)) return false;
            if (!this.#westOpen(this.#source.x+1, this.#source.y, this.#source.z+1)) return false;
        }
        else if (this.#destination.z < this.#source.z){
            if (!this.#floorOpen(this.#source.x+1, this.#source.y, this.#source.z)) return false;
            if (!this.#westOpen(this.#source.x+1, this.#source.y, this.#source.z)) return false;
        }
        return true;
    }
    //(x, y+1)
    #crossSouth(){
        if (this.#destination.z === this.#source.z){
            if (!this.#northOpen(this.#source.x, this.#source.y+1, this.#source.z)) return false;
        }
        else if (this.#destination.z > this.#source.z){
            if (!this.#floorOpen(this.#source.x, this.#source.y, this.#source.z+1)) return false;
            if (!this.#northOpen(this.#source.x, this.#source.y+1, this.#source.z+1)) return false;
        }
        else if (this.#destination.z < this.#source.z){
            if (!this.#floorOpen(this.#source.x, this.#source.y+1, this.#source.z)) return false;
            if (!this.#northOpen(this.#source.x, this.#source.y+1, this.#source.z)) return false;
        }
        return true;
    }
    //(x-1, y)
    #crossWest(){
        if (this.#destination.z === this.#source.z){
            if (!this.#westOpen(this.#source.x, this.#source.y, this.#source.z)) return false;
        }
        else if (this.#destination.z > this.#source.z){
            if (!this.#floorOpen(this.#source.x, this.#source.y, this.#source.z+1)) return false;
            if (!this.#westOpen(this.#source.x, this.#source.y, this.#source.z+1)) return false;
        }
        else if (this.#destination.z < this.#source.z){
            if (!this.#floorOpen(this.#source.x-1, this.#source.y, this.#source.z)) return false;
            if (!this.#westOpen(this.#source.x, this.#source.y, this.#source.z)) return false;
        }
        return true;
    }
    //(x+1, y-1)
    #crossNorthEast(){
        if (this.#destination.z === this.#source.z){
            if (!this.#northOpen(this.#source.x, this.#source.y, this.#source.z) && !this.#westOpen(this.#source.x+1, this.#source.y, this.#source.z)) return false;
            if (!this.#northOpen(this.#source.x, this.#source.y, this.#source.z) && !this.#northOpen(this.#source.x+1, this.#source.y, this.#source.z)) return false;
            if (!this.#westOpen(this.#source.x+1, this.#source.y, this.#source.z) && !this.#westOpen(this.#source.x+1, this.#source.y-1, this.#source.z)) return false;
        }
        else if (this.#destination.z > this.#source.z){
            if (!this.#floorOpen(this.#source.x, this.#source.y, this.#source.z+1)) return false;
            if (!this.#northOpen(this.#source.x, this.#source.y, this.#source.z+1) && !this.#westOpen(this.#source.x+1, this.#source.y, this.#source.z+1)) return false;
            if (!this.#northOpen(this.#source.x, this.#source.y, this.#source.z+1) && !this.#northOpen(this.#source.x+1, this.#source.y, this.#source.z+1)) return false;
            if (!this.#westOpen(this.#source.x+1, this.#source.y, this.#source.z+1) && !this.#westOpen(this.#source.x+1, this.#source.y-1, this.#source.z+1)) return false;
        }
            else if (this.#destination.z < this.#source.z){
            if (!this.#floorOpen(this.#source.x+1, this.#source.y-1, this.#source.z)) return false;
            if (!this.#northOpen(this.#source.x, this.#source.y, this.#source.z) && !this.#westOpen(this.#source.x+1, this.#source.y, this.#source.z)) return false;
            if (!this.#northOpen(this.#source.x, this.#source.y, this.#source.z) && !this.#northOpen(this.#source.x+1, this.#source.y, this.#source.z)) return false;
            if (!this.#westOpen(this.#source.x+1, this.#source.y, this.#source.z) && !this.#westOpen(this.#source.x+1, this.#source.y-1, this.#source.z)) return false;
        }
        return true;
    }
    //(x+1, y+1)
    #crossSouthEast(){
        if (this.#destination.z === this.#source.z){
            if (!this.#northOpen(this.#source.x, this.#source.y+1, this.#source.z) && !this.#westOpen(this.#source.x+1, this.#source.y, this.#source.z)) return false;
            if (!this.#northOpen(this.#source.x, this.#source.y+1, this.#source.z) && !this.#northOpen(this.#source.x+1, this.#source.y+1, this.#source.z)) return false;
            if (!this.#westOpen(this.#source.x+1, this.#source.y, this.#source.z) && !this.#westOpen(this.#source.x+1, this.#source.y+1, this.#source.z)) return false;
        }       
        else if (this.#destination.z > this.#source.z){
            if (!this.#floorOpen(this.#source.x, this.#source.y, this.#source.z+1)) return false;
            if (!this.#northOpen(this.#source.x, this.#source.y+1, this.#source.z+1) && !this.#westOpen(this.#source.x+1, this.#source.y, this.#source.z+1)) return false;
            if (!this.#northOpen(this.#source.x, this.#source.y+1, this.#source.z+1) && !this.#northOpen(this.#source.x+1, this.#source.y+1, this.#source.z+1)) return false;
            if (!this.#westOpen(this.#source.x+1, this.#source.y, this.#source.z+1) && !this.#westOpen(this.#source.x+1, this.#source.y+1, this.#source.z+1)) return false;
        }
        else if (this.#destination.z < this.#source.z){
            if (!this.#floorOpen(this.#source.x+1, this.#source.y+1, this.#source.z)) return false;
            if (!this.#northOpen(this.#source.x, this.#source.y+1, this.#source.z) && !this.#westOpen(this.#source.x+1, this.#source.y, this.#source.z)) return false;
            if (!this.#northOpen(this.#source.x, this.#source.y+1, this.#source.z) && !this.#northOpen(this.#source.x+1, this.#source.y+1, this.#source.z)) return false;
            if (!this.#westOpen(this.#source.x+1, this.#source.y, this.#source.z) && !this.#westOpen(this.#source.x+1, this.#source.y+1, this.#source.z)) return false;
        }
        return true;
    }
    //(x-1, y+1)
    #crossSouthWest(){
        if (this.#destination.z === this.#source.z){
            if (!this.#northOpen(this.#source.x, this.#source.y+1, this.#source.z) && !this.#westOpen(this.#source.x, this.#source.y, this.#source.z)) return false;
            if (!this.#northOpen(this.#source.x, this.#source.y+1, this.#source.z) && !this.#northOpen(this.#source.x-1, this.#source.y+1, this.#source.z)) return false;
            if (!this.#westOpen(this.#source.x, this.#source.y, this.#source.z) && !this.#westOpen(this.#source.x, this.#source.y+1, this.#source.z)) return false;
        }
        else if (this.#destination.z > this.#source.z){
            if (!this.#floorOpen(this.#source.x, this.#source.y, this.#source.z+1)) return false;
            if (!this.#northOpen(this.#source.x, this.#source.y+1, this.#source.z+1) && !this.#westOpen(this.#source.x, this.#source.y, this.#source.z+1)) return false;
            if (!this.#northOpen(this.#source.x, this.#source.y+1, this.#source.z+1) && !this.#northOpen(this.#source.x-1, this.#source.y+1, this.#source.z+1)) return false;
            if (!this.#westOpen(this.#source.x, this.#source.y, this.#source.z+1) && !this.#westOpen(this.#source.x, this.#source.y+1, this.#source.z+1)) return false;
        }
        else if (this.#destination.z < this.#source.z){
            if (!this.#floorOpen(this.#source.x-1, this.#source.y+1, this.#source.z)) return false;
            if (!this.#northOpen(this.#source.x, this.#source.y+1, this.#source.z) && !this.#westOpen(this.#source.x, this.#source.y, this.#source.z)) return false;
            if (!this.#northOpen(this.#source.x, this.#source.y+1, this.#source.z) && !this.#northOpen(this.#source.x-1, this.#source.y+1, this.#source.z)) return false;
            if (!this.#westOpen(this.#source.x, this.#source.y, this.#source.z) && !this.#westOpen(this.#source.x, this.#source.y+1, this.#source.z)) return false;
        }
        return true;
    }
    //(x-1, y-1)
    #crossNorthWest(){
        if (this.#destination.z === this.#source.z){
            if (!this.#northOpen(this.#source.x, this.#source.y, this.#source.z) && !this.#westOpen(this.#source.x, this.#source.y, this.#source.z)) return false;
            if (!this.#northOpen(this.#source.x, this.#source.y, this.#source.z) && !this.#northOpen(this.#source.x-1, this.#source.y, this.#source.z)) return false;
            if (!this.#westOpen(this.#source.x, this.#source.y, this.#source.z) && !this.#westOpen(this.#source.x, this.#source.y-1, this.#source.z)) return false;
        }
        else if (this.#destination.z > this.#source.z){
            if (!this.#floorOpen(this.#source.x, this.#source.y, this.#source.z+1)) return false;
            if (!this.#northOpen(this.#source.x, this.#source.y, this.#source.z+1) && !this.#westOpen(this.#source.x, this.#source.y, this.#source.z+1)) return false;
            if (!this.#northOpen(this.#source.x, this.#source.y, this.#source.z+1) && !this.#northOpen(this.#source.x-1, this.#source.y, this.#source.z+1)) return false;
            if (!this.#westOpen(this.#source.x, this.#source.y, this.#source.z+1) && !this.#westOpen(this.#source.x, this.#source.y-1, this.#source.z+1)) return false;
        }
        else if (this.#destination.z < this.#source.z){
            if (!this.#floorOpen(this.#source.x-1, this.#source.y-1, this.#source.z)) return false;
            if (!this.#northOpen(this.#source.x, this.#source.y, this.#source.z) && !this.#westOpen(this.#source.x, this.#source.y, this.#source.z)) return false;
            if (!this.#northOpen(this.#source.x, this.#source.y, this.#source.z) && !this.#northOpen(this.#source.x-1, this.#source.y, this.#source.z)) return false;
            if (!this.#westOpen(this.#source.x, this.#source.y, this.#source.z) && !this.#westOpen(this.#source.x, this.#source.y-1, this.#source.z)) return false;
        }
        return true;
    }
}