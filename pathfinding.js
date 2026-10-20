import { Location } from './point.js';

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

                const cube = this.findCube(nx, ny, nz);
                if(cube === null || !cube.walkable) continue;

                // Changement d'étage ou diagonale : on frôle des cases voisines,
                // il faut vérifier qu'elles laissent passer.
                if(offset.z !== 0 || (offset.x !== 0 && offset.y !== 0)){
                    const corner = new Corner(node.x, node.y, node.z, offset, (wx, wy, wz) => this.findCube(wx, wy, wz));
                    if(!corner.canPass()) continue;
                }

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

/**
 * Le passage entre deux cases n'est pas seulement une affaire de départ et
 * d'arrivée : on frôle des cases voisines en chemin, et elles peuvent barrer
 * la route. Corner regarde ces cases-là.
 *
 * Un cube absent, c'est du vide : le vide ne bloque rien, c'est même par là
 * qu'on descend d'une plateforme. Seul un cube présent et non franchissable
 * arrête le mouvement.
 *
 * findCube est injecté (Pathfinding.findCube) pour ne pas dépendre d'un global.
 */
export class Corner{

    #axeX = null;
    #axeY = null;
    #axeD = null;
    #head = null;

    constructor(wx, wy, wz, offset, findCube){
        if (offset.z > 0){
            // On monte : on traverse le palier supérieur, et sa propre verticale.
            this.#axeX = findCube(wx + offset.x, wy, wz + offset.z);
            this.#axeY = findCube(wx, wy + offset.y, wz + offset.z);
            this.#axeD = findCube(wx + offset.x, wy + offset.y, wz + offset.z);
            this.#head = findCube(wx, wy, wz + offset.z);
        } else {
            this.#axeX = findCube(wx + offset.x, wy, wz);
            this.#axeY = findCube(wx, wy + offset.y, wz);
            this.#axeD = findCube(wx + offset.x, wy + offset.y, wz);
        }
    }

    get axeX(){ return this.#axeX; }
    get axeY(){ return this.#axeY; }
    get axeD(){ return this.#axeD; }
    get head(){ return this.#head; }

    /** Un cube présent et non franchissable barre la route ; le vide non. */
    static blocked(cube){ return cube !== null && !cube.walkable; }

    canPass(){
        // La case qu'on traverse en chemin.
        if (Corner.blocked(this.#axeD)) return false;
        // En montant, on ne passe pas à travers un plafond.
        if (Corner.blocked(this.#head)) return false;
        // Les deux côtés pleins = coin fermé, on couperait à travers un mur.
        if (Corner.blocked(this.#axeX) && Corner.blocked(this.#axeY)) return false;
        return true;
    }
}
