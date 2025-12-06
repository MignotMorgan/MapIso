
export class Road{
    constructor(x, y, z){
        this.x = x;
        this.y = y;
        this.z = z;
        this.closed = false;
        this.street = [{x:x, y:y, z:z}];
    }
    copyAndAdd(road, point){
        for(let i = 0; i < road.street.length; i++)
            this.street[i] = road.street[i];
        this.street.push(point);
    }
}

export class Pathfinding{
    roads = [];
    constructor(x, y, z, map){
        this.x = x;
        this.y = y;
        this.z = z;
        this.map = map;
        this.roads.push(new Road(x, y, z));
    }
   
    contains(x, y, z)
    {
        for(var i = 0 ; i < this.roads.length; i++)
            if (this.roads[i].x == x && this.roads[i].y == y && this.roads[i].z == z)
                return true;
        return false;
    };
    
    find(x, y, z)
    {
        for (var i = 0; i < this.roads.length; i++)
            if (this.roads[i].x == x && this.roads[i].y == y && this.roads[i].z == z)
                return this.roads[i].street;
        return [{x:x, y:y, z:z}];
    }
    
    moveTo(entity, x, y, z)
    {
        if(entity.Move == null)return;//Verif!!!!!!!!!!!!!!!!!!!!!
        if (!Entity_CanMoveTo(entity, x, y, z, entity.Map)) return;
        this.onStreet(this.roads[0], entity);
        entity.Move.Street = this.find(x, y, z);
//        entity.Move.Step = 0;
        entity.Body_Animated = true;
    };
    
    onStreet(road, entity)
    {
        road.closed = true;
    
        for(let i = 1; i < 27; i++)
        {
            let direction = this.intToDirection(i);
            if (this.contains(road.x + direction.x, road.y + direction.y, road.z + direction.z)) continue;
            let cube_dest = FindCube(road.x + direction.x, road.y + direction.y, road.z + direction.z);
            if(cube_dest == null || !cube_dest.Cross)continue;

            if (direction.z != 0)
            {
                let coin = new Coin(road.x, road.y, road.z, direction);
                if (!coin.movement()) continue;
            }

            if(entity != null && !Entity_CanMove(entity, cube_dest.X, cube_dest.Y, cube_dest.Z, this.map))continue;
            
            var next_road = new Road(cube_dest.X, cube_dest.Y, cube_dest.Z);
            next_road.copyAndAdd(road, {X:cube_dest.X, Y:cube_dest.Y, Z:cube_dest.Z});
            this.roads[this.roads.length] = next_road;
        }

        for (let r = 0; r < this.roads.length; r++)
            if (!this.roads[r].closed)
                this.onStreet(this.roads[r], entity);
    };
  
    intToDirection(n){
    //int z = n / 9 == 2 ? -1 : (n / 9);
    //n %= 9;
    //int y = n / 3 == 2 ? -1 : n / 3;
    //n %= 3;
    //int x = n == 2 ? -1 : n;
    //return new Direction(x, y, z);

        let x = 0;
        let y = 0;
        let z = 0;
        let n2 = n % 9;
        switch (n2)
        {
        case 0: { x = 0; y = 0; break; }    //None
        case 1: { x = 0; y = -1; break; }   //N
        case 2: { x = 1; y = 0; break; }    //E
        case 3: { x = 0; y = 1; break; }    //S
        case 4: { x = -1; y = 0; break; }   //W
        case 5: { x = -1; y = -1; break; }  //N-W
        case 6: { x = 1; y = -1; break; }   //N-E
        case 7: { x = 1; y = 1; break; }    //S-E
        case 8: { x = -1; y = 1; break; }   //S-W
        }
        if (n >= 18) z = 1;                     //Up
        else if (n >= 9) z = -1;                //Down

        return {x:x, y:y, z:z}; //new Direction(x, y, z);
    };
}
export class Coin{
    constructor(x, y, z, d){
        this.axe_x = null;
        this.axe_y = null;
        this.axe_d = null;

        if (d.Z > 0)
        {
            this.axe_x = FindCube(x + d.X, y, z + d.Z);
            this.axe_y = FindCube(x, y + d.Y, z + d.Z);
            this.axe_d = FindCube(x + d.X, y + d.Y, z + d.Z);
        }
        else
        {
            this.axe_x = FindCube(x + d.X, y, z);
            this.axe_y = FindCube(x, y + d.Y, z);
            this.axe_d = FindCube(x + d.X, y + d.Y, z);
        }
    }
    movement(){
        if (this.axe_d == null || !this.axe_d.Cross) return false;
        if (this.axe_x != null && !this.axe_x.Cross && this.axe_y != null && !this.axe_y.Cross) return false;
        return true;
    }
}
