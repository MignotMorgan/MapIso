
export class EntityDraw{
    constructor(entity){

        this.ID = entity.ID;
        this.canMove = entity.canMove;
        this.body = entity.body;
        this.screen = LocationToScreen(entity.x, entity.y, entity.z, PageInfo.MapInfo.SizeCube);
        this.x = entity.x;
        this.y = entity.y;
        this.z = entity.z;
        this.adjustment = {x:entity.adjustment.x, y:entity.adjustment.y};
        this.direction = entity.direction;
        this.width = PageInfo.MapInfo.SizeCube * 2 * entity.Width;
        this.height = PageInfo.MapInfo.SizeCube * entity.Height + PageInfo.MapInfo.SizeCube  * entity.Width;
        this.move = entity.Move;
        this.moveDraw = entity.MoveDraw;

        
        this.location = {x: entity.x, y:entity.y, z:entity.z};
        this.toScreen(this.screen.x, this.screen.y);
    }
    toScreen(x, y)//Supprimer!!!!!!!
    {
        this.screen.X = x - (this.width/2);
        this.screen.Y = y - this.height + (this.width/2);
        if(PageInfo.MapInfo.Adjusted)
        {
            this.screen.X += PageInfo.MapInfo.SizeCube * (this.adjustment.x /100);
            this.screen.Y += PageInfo.MapInfo.SizeCube * (this.adjustment.y /100);
        }
    }

    onDistance(location_dest, adjustment)
    {
        this.moveDraw.location.x = this.x;
        this.moveDraw.location.y = this.y;
        this.moveDraw.location.z = this.z;
        this.moveDraw.adjustment.x = this.adjustment.x;
        this.moveDraw.adjustment.y = this.adjustment.y;
    
        let case_src = {x:0,y:0, adjustment:{x:0,y:0}};
        let case_dest = {x:0,y:0, adjustment:{x:0,y:0}}; 

        case_src.x = this.moveDraw.location.x - this.moveDraw.location.z;
        case_src.y = this.moveDraw.location.y - this.moveDraw.location.z;
        case_src.adjustment.x = this.moveDraw.adjustment.x;
        case_src.adjustment.y = this.moveDraw.adjustment.y;

        case_dest.x = location_dest.x - location_dest.z;
        case_dest.y = location_dest.y - location_dest.z;
        case_dest.adjustment.x = adjustment.x;
        case_dest.adjustment.y = adjustment.y;

        this.moveDraw.distance = CaseToCase(case_src, case_dest);
        this.moveDraw.drawStep = 0;

        var ratio_X = Math.abs( this.MoveDraw.Distance.x/100);
        var ratio_Y = Math.abs( this.MoveDraw.Distance.y/100);

        var ratio_Speed_X = this.move.speed * ratio_X;
        var ratio_Speed_Y = this.move.speed * ratio_Y;
        if(ratio_Speed_X > ratio_Speed_Y)this.moveDraw.time = ratio_Speed_X;
        else this.moveDraw.time = ratio_Speed_Y;

        this.direction = ScreenDirection(this.moveDraw.distance.x, this.moveDraw.distance.y);
//        this.Direction = ScreenDirection(Case_src.X, Case_src.Y, Case_dest.X, Case_dest.Y);

//        if(this.ID == Selected.ID)
//            SelectedMove();

//MovementInfo.List[MovementInfo.List.length] = "________________________";
//MovementInfo.List[MovementInfo.List.length] = "Case_src : "+ Case_src.X + " : "+ Case_src.Y +" # "+ Case_src.Adjustment.X +" : "+ Case_src.Adjustment.Y;
//MovementInfo.List[MovementInfo.List.length] = "Case_dest : "+ Case_dest.X + " : "+ Case_dest.Y +" # "+ Case_dest.Adjustment.X +" : "+ Case_dest.Adjustment.Y;
//MovementInfo.List[MovementInfo.List.length] = "Distance : "+ this.MoveDraw.Distance.X + " : "+ this.MoveDraw.Distance.Y;



    };
    changeDirection(x_src, y_src, z_src, x_dest, y_dest, z_dest)
    {
        if ( x_src == x_dest && y_src == y_dest)return 6;           //None
        else if ( x_src == x_dest && y_src > y_dest)return 0;       //N
        else if ( x_src < x_dest && y_src == y_dest)return 1;       //E
        else if ( x_src == x_dest && y_src < y_dest)return 2;       //S
        else if ( x_src > x_dest && y_src == y_dest)return 3;       //W
        else if ( x_src > x_dest && y_src > y_dest)return 4;        //N-W
        else if ( x_src < x_dest && y_src > y_dest)return 5;        //N-E
        else if ( x_src < x_dest && y_src < y_dest)return 6;        //S-E
        else if ( x_src > x_dest && y_src < y_dest)return 7;        //S-W
        return 6;
    };
    screenDirection(x_dest, y_dest)
    {
        let x = 0;
        let y = 0;
        let size = 50;// PageInfo.MapInfo.SizeCube/2;

        if( -25 < x_dest && x_dest < 25)
        {
            if(x_dest < 0)x = -1;
            else if(x_dest > 0)x = 1;
        }
        else
        {
            if(x_dest < -25)x = -1;
            else if(x_dest > 25)x = 1;
        }

        if( -25 < y_dest && y_dest < 25)
        {
            if(y_dest < 0)y = -1;
            else if(y_dest > 0)y = 1;
        }
        else
        {
            if(y_dest < -25)y = -1;
            else if(y_dest > 25)y = 1;
        }

        if( -25 < y_dest && y_dest < 25)
        {
            if(y_dest < 0)y = -1;
            else if(y_dest > 0)y = 1;
        }
        else
        {
            if(y_dest < -25)y = -1;
            else if(y_dest > 25)y = 1;
        }
    
//    if(x_dest < -size)x = -1;
//    else if(x_dest > size)x = 1;
//    if(y_dest < -size)y = -1;
//    else if(y_dest > size)y = 1;

//    if(x < 0) x = -1;
//    else if(x > 0) x = 1;
//    else x = 0;
//    
//    if(y < 0) y = -1;
//    else if (y > 0) y = 1;
//    else y = 0;



        if( x == 0 && y == 0 )return 6;             //None
        else if( x == 1 && y == -1 )return 0;       //N
        else if( x == 1 && y == 1 )return 1;        //E
        else if( x == -1 && y == 1 )return 2;       //S
        else if( x == -1 && y == -1 )return 3;      //W
        else if( x == 0 && y == -1 )return 4;       //N-W
        else if( x == 1 && y == 0 )return 5;        //N-E
        else if( x == 0 && y == 1 )return 6;        //S-E
        else if( x == -1 && y == 0 )return 7;       //S-W

        return 6;
    };
}