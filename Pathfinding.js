/**
 * Un nœud de recherche : un cube atteint, plus le nœud d'où l'on vient.
 *
 * On ne stocke pas le chemin complet dans chaque nœud (c'était le cas avant, et
 * recopier le trajet à chaque case coûtait très cher) : on garde seulement le
 * parent, et on reconstruit le chemin une seule fois, à la fin, avec street().
 */
export class Road{

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
        this.#distance = parent == null ? 0 : parent.distance + 1;
    }

    get x(){ return this.#x; }
    get y(){ return this.#y; }
    get z(){ return this.#z; }
    get parent(){ return this.#parent; }
    /** Nombre de pas depuis le départ. Sert à limiter la portée de la recherche. */
    get distance(){ return this.#distance; }

    /** Remonte les parents et renvoie le trajet complet, du départ jusqu'ici. */
    street(){
        const street = [];
        let road = this;
        while(road != null){
            street[street.length] = {x:road.x, y:road.y, z:road.z};
            road = road.parent;
        }
        return street.reverse();
    }
}

/**
 * Recherche de chemin en 3D, de proche en proche (parcours en largeur).
 *
 * Chaque case a 26 voisins : 8 au même niveau, 9 au-dessus, 9 en dessous.
 * On explore par cercles concentriques, donc le premier chemin trouvé est
 * toujours le plus court en nombre de pas.
 *
 * Usage : new Pathfinding(x, y, z, map).moveTo(entity, destX, destY, destZ)
 * Le trajet est écrit dans entity.move.street.
 *
 * map doit exposer cubeAt(x, y, z) — c'est tout. Le moteur ignore donc
 * comment la carte range ses cubes, ce qui la rend remplaçable (une carte
 * unique aujourd'hui, un assemblage de cartes plus tard).
 */
export class Pathfinding{

    // Les 26 directions, calculées une seule fois pour toutes les recherches.
    static #directions = null;

    #x = 0;
    #y = 0;
    #z = 0;
    #map = null;
    //maxDistance : portée en nombre de pas. Sans limite, une carte immense gèlerait le jeu.
    #maxDistance = 48;
    //maxRoads : garde-fou absolu sur le nombre de cases explorées.
    #maxRoads = 20000;
    //roads : tous les nœuds visités, dans l'ordre de découverte.
    #roads = [];
    //visited : index des cases déjà vues, pour ne jamais repasser au même endroit.
    #visited = new Set();

    constructor(x, y, z, map, options = {}){
        this.#x = x;
        this.#y = y;
        this.#z = z;
        this.#map = map ?? null;
        this.#maxDistance = options.maxDistance ?? 48;
        this.#maxRoads = options.maxRoads ?? 20000;
    }

    get x(){ return this.#x; }
    get y(){ return this.#y; }
    get z(){ return this.#z; }
    get map(){ return this.#map; }
    set map(value){ this.#map = value ?? null; }
    get maxDistance(){ return this.#maxDistance; }
    set maxDistance(value){ this.#maxDistance = value ?? 48; }
    get maxRoads(){ return this.#maxRoads; }
    set maxRoads(value){ this.#maxRoads = value ?? 20000; }
    get roads(){ return this.#roads; }

    /** Cube du monde. On demande à la carte, on ne fouille jamais sa grille nous-même. */
    findCube(x, y, z){
        if(this.#map == null) return null;
        return this.#map.cubeAt(x, y, z);
    }

    /** Cette case a-t-elle déjà été explorée ? Réponse immédiate, quelle que soit la taille du monde. */
    contains(x, y, z){
        return this.#visited.has(Pathfinding.#key(x, y, z));
    }

    /**
     * Explore jusqu'à atteindre (x,y,z), et s'arrête dès qu'on l'a trouvée.
     * Renvoie le nœud d'arrivée, ou null si la case est hors de portée / inaccessible.
     */
    search(x, y, z, entity = null){
        this.#roads = [];
        this.#visited = new Set();

        if(entity != null && !entity.canMove) return null;

        const start = new Road(this.#x, this.#y, this.#z);
        this.#roads[0] = start;
        this.#visited.add(Pathfinding.#key(start.x, start.y, start.z));
        if(start.x == x && start.y == y && start.z == z) return start;

        const directions = Pathfinding.directions();

        // File d'attente : on avance avec un curseur au lieu de retirer le premier
        // élément, et surtout sans récursion (une carte immense ferait déborder la pile).
        for(let head = 0; head < this.#roads.length; head++)
        {
            const road = this.#roads[head];
            if(road.distance >= this.#maxDistance) continue;

            for(let d = 0; d < directions.length; d++)
            {
                const direction = directions[d];
                const nx = road.x + direction.x;
                const ny = road.y + direction.y;
                const nz = road.z + direction.z;

                const key = Pathfinding.#key(nx, ny, nz);
                if(this.#visited.has(key)) continue;

                const cube = this.findCube(nx, ny, nz);
                if(cube == null || !cube.cross) continue;

                // Changement d'étage : les cases d'angle doivent rester franchissables.
                if(direction.z != 0){
                    const coin = new Coin(road.x, road.y, road.z, direction, (cx, cy, cz) => this.findCube(cx, cy, cz));
                    if(!coin.movement()) continue;
                }

                this.#visited.add(key);
                const next = new Road(cube.x, cube.y, cube.z, road);
                this.#roads[this.#roads.length] = next;

                if(next.x == x && next.y == y && next.z == z) return next;
                if(this.#roads.length >= this.#maxRoads) return null;
            }
        }
        return null;
    }

    /**
     * Trajet vers (x,y,z), du départ à l'arrivée.
     * Tableau d'un seul point si la destination n'est pas atteignable :
     * l'appelant doit donc vérifier la longueur avant de faire bouger quoi que ce soit.
     */
    find(x, y, z, entity = null){
        const road = this.search(x, y, z, entity);
        if(road == null) return [{x:x, y:y, z:z}];
        return road.street();
    }

    /**
     * Donne l'ordre de marche à une entité.
     * Renvoie false si elle ne peut pas bouger ou si la destination est inaccessible ;
     * dans ce cas rien n'est modifié, l'entité reste sur place.
     */
    moveTo(entity, x, y, z){
        if(entity == null) return false;
        if(!entity.canMove) return false;
        if(entity.move == null) return false;   // pas de buffer de déplacement

        const road = this.search(x, y, z, entity);
        if(road == null) return false;

        entity.move.street = road.street();
        entity.move.step = 0;
        entity.bodyAnimated = true;             // bascule le sprite en marche
        return true;
    }

    /** Les 26 voisins d'une case, construits une seule fois. */
    static directions(){
        if(this.#directions != null) return this.#directions;
        const directions = [];
        for(let n = 1; n < 27; n++){
            const direction = Pathfinding.intToDirection(n);
            if(direction.x == 0 && direction.y == 0 && direction.z == 0) continue;
            directions[directions.length] = direction;
        }
        this.#directions = directions;
        return directions;
    }

    /**
     * n 1..26 → (x,y,z) ∈ {-1,0,1}.
     * n%9 = plan horizontal (0 = rester, 1 N … 8 S-W).
     * n>=18 monte, 9..17 descend.
     */
    static intToDirection(n){
        let x = 0;
        let y = 0;
        let z = 0;
        const n2 = n % 9;
        switch (n2){
        case 0: { x = 0; y = 0; break; }
        case 1: { x = 0; y = -1; break; }
        case 2: { x = 1; y = 0; break; }
        case 3: { x = 0; y = 1; break; }
        case 4: { x = -1; y = 0; break; }
        case 5: { x = -1; y = -1; break; }
        case 6: { x = 1; y = -1; break; }
        case 7: { x = 1; y = 1; break; }
        case 8: { x = -1; y = 1; break; }
        }
        if (n >= 18) z = 1;
        else if (n >= 9) z = -1;
        return {x:x, y:y, z:z};
    }
    /** Conservé pour compatibilité : préférer Pathfinding.directions(). */
    intToDirection(n){ return Pathfinding.intToDirection(n); }

    static #key(x, y, z){ return x + "," + y + "," + z; }
}

/**
 * En montée/descente, les cubes « coin » (axe X, Y, diagonale) doivent rester franchissables.
 * Montée : on teste le palier supérieur ; descente : le palier actuel.
 * findCube est injecté (Pathfinding.findCube) pour ne pas dépendre d'un global.
 */
export class Coin{

    #axeX = null;
    #axeY = null;
    #axeD = null;

    constructor(x, y, z, d, findCube){
        if (d.z > 0){
            this.#axeX = findCube(x + d.x, y, z + d.z);
            this.#axeY = findCube(x, y + d.y, z + d.z);
            this.#axeD = findCube(x + d.x, y + d.y, z + d.z);
        } else {
            this.#axeX = findCube(x + d.x, y, z);
            this.#axeY = findCube(x, y + d.y, z);
            this.#axeD = findCube(x + d.x, y + d.y, z);
        }
    }

    get axeX(){ return this.#axeX; }
    get axeY(){ return this.#axeY; }
    get axeD(){ return this.#axeD; }

    movement(){
        // Diagonale bloquée ou absente → on ne grimpe / ne descend pas.
        if (this.#axeD == null || !this.#axeD.cross) return false;
        // Les deux côtés pleins = coin fermé (on passerait à travers un mur).
        if (this.#axeX != null && !this.#axeX.cross && this.#axeY != null && !this.#axeY.cross) return false;
        return true;
    }
}
