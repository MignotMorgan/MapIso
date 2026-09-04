/**
 * Un nœud de recherche : cube atteint + chemin depuis le départ (street).
 * closed = déjà expansé (on ne le retire pas, on skip au prochain passage).
 */
export class Road{
    constructor(x, y, z){
        this.x = x;
        this.y = y;
        this.z = z;
        this.closed = false;
        this.street = [{x:x, y:y, z:z}];
    }
    /** Clone le chemin parent et ajoute le cube voisin. */
    copyAndAdd(road, point){
        for(let i = 0; i < road.street.length; i++)
            this.street[i] = road.street[i];
        this.street.push(point);
    }
}

/**
 * BFS 3D (26 voisins : 8 au même z, 9 en haut, 9 en bas ; i=0 est ignoré).
 * new Pathfinding(x, y, z, map) puis moveTo(entity, destX, destY, destZ)
 * écrit le chemin dans entity.move.street.
 *
 * map doit exposer cubes[x][y][z] et width/height/depth (camelCase ou PascalCase).
 */
export class Pathfinding{
    roads = [];
    constructor(x, y, z, map){
        this.x = x;
        this.y = y;
        this.z = z;
        this.map = map;
        this.roads.push(new Road(x, y, z));
    }
    /** True si ce cube a déjà une Road (évite les cycles). */
    contains(x, y, z){
        for(let i = 0 ; i < this.roads.length; i++)
            if (this.roads[i].x == x && this.roads[i].y == y && this.roads[i].z == z)
                return true;
        return false;
    }
    /** Chemin vers (x,y,z), ou un street d'un seul point si jamais atteint. */
    find(x, y, z){
        for (let i = 0; i < this.roads.length; i++)
            if (this.roads[i].x == x && this.roads[i].y == y && this.roads[i].z == z)
                return this.roads[i].street;
        return [{x:x, y:y, z:z}];
    }
    findCube(x, y, z){
        const map = this.map;
        if(map == null) return null;
        const cubes = map.cubes ?? map.Cubes;
        if(!cubes || cubes.length == 0) return null;
        const width = map.width ?? map.Width;
        const height = map.height ?? map.Height;
        const depth = map.depth ?? map.Depth;
        if(x < 0 || y < 0 || z < 0 || x >= width || y >= height || z >= depth) return null;
        return cubes[x]?.[y]?.[z] ?? null;
    }
    moveTo(entity, x, y, z){
        if(entity.move == null) return;   // pas de buffer de déplacement
        if(!entity.canMove) return;
        this.onStreet(this.roads[0], entity);
        entity.move.street = this.find(x, y, z);
        entity.bodyAnimated = true;       // bascule le sprite en marche
    }
    /**
     * Expansions récursives : pour chaque voisin traversable, une nouvelle Road.
     * cube.cross = sol / passage ; Coin bloque les coins en changement d'altitude.
     */
    onStreet(road, entity){
        road.closed = true;

        for(let i = 1; i < 27; i++){
            const direction = this.intToDirection(i);
            if (this.contains(road.x + direction.x, road.y + direction.y, road.z + direction.z)) continue;
            const cube_dest = this.findCube(road.x + direction.x, road.y + direction.y, road.z + direction.z);
            if(cube_dest == null || !cube_dest.cross) continue;

            if (direction.z != 0){
                const coin = new Coin(road.x, road.y, road.z, direction, (cx, cy, cz) => this.findCube(cx, cy, cz));
                if (!coin.movement()) continue;
            }

            if(entity != null && !entity.canMove) continue;

            const next_road = new Road(cube_dest.x, cube_dest.y, cube_dest.z);
            next_road.copyAndAdd(road, {x: cube_dest.x, y: cube_dest.y, z: cube_dest.z});
            this.roads.push(next_road);
        }

        for (let r = 0; r < this.roads.length; r++)
            if (!this.roads[r].closed)
                this.onStreet(this.roads[r], entity);
    }
    /**
     * n 1..26 → (x,y,z) ∈ {-1,0,1}.
     * n%9 = plan horizontal (0 = rester, 1 N … 8 S-W).
     * n>=18 monte, 9..17 descend.
     */
    intToDirection(n){
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
}

/**
 * En montée/descente, les cubes « coin » (axe X, Y, diagonale) doivent rester franchissables.
 * Montée : on teste le palier supérieur ; descente : le palier actuel.
 * findCube est injecté (Pathfinding.findCube) pour ne pas dépendre d'un global.
 */
export class Coin{
    constructor(x, y, z, d, findCube){
        this.axe_x = null;
        this.axe_y = null;
        this.axe_d = null;

        if (d.z > 0){
            this.axe_x = findCube(x + d.x, y, z + d.z);
            this.axe_y = findCube(x, y + d.y, z + d.z);
            this.axe_d = findCube(x + d.x, y + d.y, z + d.z);
        } else {
            this.axe_x = findCube(x + d.x, y, z);
            this.axe_y = findCube(x, y + d.y, z);
            this.axe_d = findCube(x + d.x, y + d.y, z);
        }
    }
    movement(){
        // Diagonale bloquée ou absente → on ne grimpe / ne descend pas.
        if (this.axe_d == null || !this.axe_d.cross) return false;
        // Les deux côtés pleins = coin fermé (on passerait à travers un mur).
        if (this.axe_x != null && !this.axe_x.cross && this.axe_y != null && !this.axe_y.cross) return false;
        return true;
    }
}
