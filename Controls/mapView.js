import { Core } from 'Control/core.js';
import { CoreIso } from '../coreIso.js';
import { Control } from 'Control/control.js';
import { EntityDraw } from '../entitydraw.js';
import { Pathfinding } from '../Pathfinding.js';
import { Point, Location, CasePoint } from '../pointIso.js';

export class MapView extends Control{
    //grap : Gestion du déplacement de la vue ("grab" pour saisir/déplacer) 
     #grap = {x:0, y:0, adjustment:{x:0,y:0}, border:25, step:25, modified:false, rolled:0};
    //wallCeil : Mode d'affichage des murs et plafonds
    #wallCeil = 0;    
    //selected : Gestion des entités sélectionnées par le joueur
    #selected = { ID:"", Multi:[], Target:"" };   
    //target : Cible actuelle sous le curseur de la souris
    #target = {id:"", case:null, cube:null};
    //selectedMulti : Gestion de la sélection multiple par glisser-déposer
    #selectedMulti = { Source:{X:0,Y:0}, Destination:{X:0,Y:0}, Active:false };
    //selectedMouse : Gestion des pouvoirs/actions avec limitation de portée.
    #selectedMouse = {power:null, target:"",x:0,y:0,z:0, range:3};

    // Carte voxel (cubes + permanents). Remplace l'ancien PageInfo.Map.
    #map = null;
    //entitys : Tableau des entités dynamiques (personnages, objets mobiles)
    #entitys = new Array();
    //entitysDraw : Tableau optimisé des entités pour l'affichage
    #entitysDraw = new Array();
    //permanentsDraw : Tableau des entités permanentes pour l'affichage
    #permanentsDraw = [];
    //temporyCubes : Buffer temporaire pour les nouveaux cubes reçus du serveur
    #temporyCubes = new Array();
    //temporyEntitys : Buffer temporaire pour un ensemble complet d'entités
    #temporyEntitys = null;
    //temporyEntity : Buffer temporaire pour les entités individuelles
    #temporyEntity = new Array();
    //noCeiling : Tableau des zones sans plafond pour la visibilité
    #noCeiling = new Array();
    //resizeCases : Flag indiquant qu'il faut recalculer toutes les cases
    //#resizeCases = true;
    //createCase : Flag indiquant qu'il faut recréer le contenu des cases
    #createCase = false;
    //createCubes : Flag indiquant qu'il faut traiter de nouveaux cubes
    #createCubes = false;
    //createEntityDraw : Flag indiquant qu'il faut recalculer l'affichage des entités
    #createEntityDraw = true;

    //case : Représente la position d'une case sur la grille isométrique
    #case = new CasePoint();
    /**
     * location : point du monde affiché au coin HAUT-GAUCHE de la vue.
     * Le champ de vision s'ouvre ensuite vers la droite et vers le bas, en
     * losange. Utiliser moveTo() pour la déplacer, afin que la vue se recalcule.
     */
    #location = new Location();
    #frame = {x:100, y:200, width:600, height:300};
    #revise = {screen:{x:0, y:0}, adjustment:{x:0,y:0}, step:25, modified:false, rolled:0};
    #sizeCase;
    #nbrCases= 10;
    #modified = false;
    //#colsCase;
    //#rowsCase;
    //cases : Tableau des cases 3D visibles à l'écran
    #cases = [];
    //maxZ : Niveau maximum d'affichage en profondeur (altitude)
    #maxZ = 10;
    //floorsDefault : textures dessinées sous les cases vides (repère de l'éditeur)
    #floorsDefault = [];
    //adjusted : si vrai, l'offset sous-case des entités décale leur sprite
    #adjusted = true;
    // Repères du dernier remplissage, pour ne recalculer les colonnes qu'en cas de changement.
    #drawn = {x:NaN, y:NaN, z:NaN, maxZ:-1, wallCeil:-1};
    //clock : temps écoulé entre deux images, en millisecondes.
    #clock = {last:0, elapsed:0};

    constructor(){
        super();
        //this.nbrCases = 10;
        //this.#sizeCase = 3;
        //this.#colsCase = 20;
        //this.#rowsCase = 20;
    }

    initialize(){
        super.initialize();
        this.modify();
    }
    /**
     * Un tour de boucle : on ne refait que ce qui a changé.
     * Les colonnes de cubes ne bougent que si la caméra ou la carte bouge ;
     * les entités, elles, sont replacées à chaque image puisqu'elles marchent.
     */
    tick(){
        super.tick();
        if(this.#modified)
            this.modify();

        if(this.viewChanged()) this.#createCubes = true;
        if(this.#createCubes){
            this.createCubes();
            this.#createCubes = false;
        }
        if(this.#createEntityDraw){
            this.createEntitysDraw();
            this.#createEntityDraw = false;
        }
        this.placeEntitysDraw(this.elapsed());
    }
    /**
     * Millisecondes écoulées depuis l'image précédente.
     * On plafonne : si l'onglet a été mis en arrière-plan, un écart énorme
     * ferait traverser la carte d'un coup aux personnages.
     */
    elapsed(){
        const now = Date.now();
        const clock = this.#clock;
        if(clock.last == 0){ clock.last = now; clock.elapsed = 0; return 0; }
        clock.elapsed = Math.min(now - clock.last, 200);
        clock.last = now;
        return clock.elapsed;
    }
    /** La caméra ou le mode d'affichage ont-ils bougé depuis le dernier remplissage ? */
    viewChanged(){
        const drawn = this.#drawn;
        const location = this.#location;
        if(drawn.x === location.x && drawn.y === location.y && drawn.z === location.z
            && drawn.maxZ === this.#maxZ && drawn.wallCeil === this.#wallCeil) return false;
        drawn.x = location.x;
        drawn.y = location.y;
        drawn.z = location.z;
        drawn.maxZ = this.#maxZ;
        drawn.wallCeil = this.#wallCeil;
        return true;
    }
    /** Déplace la caméra. Le monde sous la vue est recalculé au prochain tour. */
    moveTo(x, y, z = this.#location.z){
        this.#location.set(x, y, z);
        this.#createCubes = true;
    }
    get case(){ return this.#case; }
    // On recopie dans la case existante : la vue garde la sienne, personne ne
    // peut lui glisser un objet d'une autre forme à la place.
    set case(value){ this.#case.copy(value); }
    get location(){ return this.#location; }
    get frame(){ return this.#frame; } //Supprimer!!
    get revise(){ return this.#revise; }
    get sizeCase(){ return this.#sizeCase; }
    get nbrCases(){ return this.#nbrCases; }
    set nbrCases(value){ 
        value < 1 ? value = 1 : this.#nbrCases = value; 
        //this.#sizeCase = this.sizeCaseFrame(); 
        this.modified();
    }

    //set sizeCase(value){ this.#sizeCase = value; }
    //get colsCase(){ return this.#colsCase; }
    //get rowsCase(){ return this.#rowsCase; }
    get cases(){ return this.#cases; }
    set cases(value){ this.#cases = value; }
    get maxZ(){ return this.#maxZ; }
    set maxZ(value){ this.#maxZ = value; }
    get floorsDefault(){ return this.#floorsDefault; }
    set floorsDefault(value){ this.#floorsDefault = value || []; }
    get adjusted(){ return this.#adjusted; }
    set adjusted(value){ this.#adjusted = !!value; this.#createEntityDraw = true; }


    get grap(){ return this.#grap; }
    get wallCeil(){ return this.#wallCeil; }
    set wallCeil(value){ this.#wallCeil = value ?? 0; }
    get selected(){ return this.#selected; }
    get target(){ return this.#target; }
    get selectedMulti(){ return this.#selectedMulti; }
    get selectedMouse(){ return this.#selectedMouse; }
    //get cases3D(){ return this.#cases3D; }
    get map(){ return this.#map; }
    /** Brancher une carte suffit : la vue se remplit toute seule au tour suivant. */
    set map(value){
        this.#map = value ?? null;
        this.#noCeiling = [];
        this.#createCubes = true;
        this.#createEntityDraw = true;
    }
    get entitys(){ return this.#entitys; }
    get entitysDraw(){ return this.#entitysDraw; }
    get permanentsDraw(){ return this.#permanentsDraw; }
    get temporyCubes(){ return this.#temporyCubes; }
    get temporyEntitys(){ return this.#temporyEntitys; }
    get temporyEntity(){ return this.#temporyEntity; }
    get noCeiling(){ return this.#noCeiling; }
    //get resizeCases(){ return this.#resizeCases; }
    get createCase(){ return this.#createCase; }
    get createCubes(){ return this.#createCubes; }
    get createEntityDraw(){ return this.#createEntityDraw; }

    modified(){ this.#modified = true; }
    modify(){
        this.#sizeCase = this.sizeCaseFrame();
        this.createCases();
        this.#modified = false;
        this.#createCubes = true;
        this.#createEntityDraw = true;   // la taille des sprites dépend de sizeCase
    }

    newCase(x, y ){
        const c = CoreIso.FactoryElementIso.createCase(x, y);
        c.screen = this.screenFromCase(x, y );
        return c;
    }
    nbrCasesFrame(){
        const sizeCase = this.sizeCase;
        const redressed = this.redress();
        const width = redressed.width;
        return Math.round(width/sizeCase/2);
    }
    sizeCaseFrame(){
        const sizeCase = this.sizeCase;
        const redressed = this.redress();
        const width = redressed.width;
        return (width/this.nbrCases)/2;
    }
    redress(){
        const redressed = {x:0, y:0, width:0, height:0};
        const rect = this.Rectangle.rectangleBackground();
        redressed.x = rect.x + this.#revise.adjustment.x;
        redressed.y = rect.y + this.#revise.adjustment.y;
        redressed.width = rect.width;
        redressed.height = rect.height;
        //console.log(redressed);
        return redressed;
    }
    /**
     * Souris dans le repère de dessin : le même que case.screen et
     * entityDraw.screen. Mouse.inside() est relatif au contrôle, pas au
     * formulaire, et comparer les deux décale toute détection de clic.
     */
    mouseFromScreen(){
        const form = this.form;
        return new Point(Core.mouse.x - form.Inside.x,
                         Core.mouse.y - form.Inside.y);
    };
    caseFromMouse(){
        const mouse = this.mouseFromScreen();
        return this.caseFromScreen(mouse.x, mouse.y);
    };
    caseFromScreen(x, y){
        const sizeCase = this.sizeCase;
        const redressed = this.redress();
        let c = new CasePoint();

        x -= (redressed.x + sizeCase);
        y -= redressed.y;
        y -= (sizeCase/2);

        x = ((x/sizeCase)*100);
        y = ((y/sizeCase)*100);
        //y = ((y-(sizeCase/2))/sizeCase)*100;  

        let pY = ((2*y-x)/2);
        let pX = (x+pY);
    
        c.y = Math.round(pY/100);
        c.x = Math.round(pX/100);
    
        c.adjustment.x = Math.round(x-((c.x-c.y)*100));
        c.adjustment.y = Math.round(y-((c.x+c.y)*50));

        return c;
    };
    screenFromCase(x, y){
        const sizeCase = this.sizeCase;
        const redressed = this.redress();

        return new Point(((x - y) * sizeCase) + redressed.x + sizeCase,
                         ((x + y) * sizeCase / 2) + redressed.y);
    };
 
    //A faire!!!
    caseFromLocation(x, y, z){
        return new CasePoint();
    }

    screenFromLocation(x, y, z){
        const sizeCase = this.sizeCase;
        const redressed = this.redress();
        const location = this.#location;

    /**
     * Coordonnées relatives à la caméra, avec la correction de parallaxe due à
     * l'altitude : monter d'un cube décale d'une case en x comme en y, c'est ce
     * qui donne l'illusion du relief.
     */
        const cX = x - location.x - (z - location.z);
        const cY = y - location.y - (z - location.z);

    // Formules isométriques standard, dans le repère du contrôle et avec la
    // même origine que screenFromCase, sinon entités et cases se décalent.
        return new Point(parseInt((cX - cY) * sizeCase) + redressed.x + sizeCase,
                         parseInt((cX + cY) * sizeCase / 2) + redressed.y);
    };
    createCases(){
        const maxCases = this.nbrCases*2;
        this.cases = [];
        for(let x = 0-maxCases; x <= maxCases; x++){
            for(let y = 0-maxCases; y <= maxCases; y++){
                const abs = Math.abs(x)+Math.abs(y);
                if(x - y >= -2 && x + y >= -2 && abs <= maxCases){
                    const c = this.newCase(x, y);
                    this.cases.push(c);
                }
            }
        }
    }


    
    /**
     * Remplit chaque case visible avec la colonne de cubes monde.
     * px/py : origine caméra + offset case, moins z caméra (parallaxe).
     * À z croissant on ajoute z à x et y : un étage « recule » en iso.
     */
    createCubes()
    {
        if(this.map == null)return;
        for(let i = 0; i < this.cases.length; i++)
        {
            const C2D = this.cases[i];
            C2D.cubes = [];
            const px = this.location.x + C2D.x - this.location.z;
            const py = this.location.y + C2D.y - this.location.z;
            let c;

            for (let z = 0; z <= this.maxZ; z++)
            {
                c = this.findCube(px + z, py + z, z);
                if(c != null && !this.containsNoCeiling(c.x, c.y, c.z))
                        C2D.cubes[C2D.cubes.length] = c;
            }

        }
    }

    /** Entités mobiles : celles de la carte, plus celles propres à cette vue. */
    mobiles(){
        const mobiles = this.map == null ? [] : this.map.entitys;
        if(this.#entitys.length == 0) return mobiles;
        return mobiles.concat(this.#entitys);
    }

    /**
     * Construit la vue écran des entités (taille du sprite, ancrage).
     * Opération lourde : on ne la refait qu'au changement de carte ou de zoom,
     * pas à chaque image.
     */
    createEntitysDraw(){
        const sizeCase = this.sizeCase;
        const permanents = this.map == null ? [] : this.map.permanents;
        const mobiles = this.mobiles();

        this.#permanentsDraw = [];
        for(let p = 0; p < permanents.length; p++)
            if(permanents[p] != null)
                this.#permanentsDraw[this.#permanentsDraw.length] = new EntityDraw(permanents[p], sizeCase, this.#adjusted);

        this.#entitysDraw = [];
        for(let e = 0; e < mobiles.length; e++)
            if(mobiles[e] != null)
                this.#entitysDraw[this.#entitysDraw.length] = new EntityDraw(mobiles[e], sizeCase, this.#adjusted);
    }

    /**
     * Fait avancer les entités, puis range chacune dans la case qu'elle occupe.
     * Refait à chaque image : c'est ce qui permet à un personnage de marcher et
     * de passer devant puis derrière un mur au bon moment.
     */
    placeEntitysDraw(elapsed = 0){
        for(let c = 0; c < this.#cases.length; c++)
            this.#cases[c].entitysDraw = [];

        this.placeDraws(this.#permanentsDraw, elapsed);
        this.placeDraws(this.#entitysDraw, elapsed);
    }
    placeDraws(draws, elapsed){
        for(let i = 0; i < draws.length; i++){
            const draw = draws[i];
            const entity = draw.entity;

            // Le monde avance d'abord, l'écran suit ensuite.
            if(entity.advance(elapsed) && entity.id == this.selected.ID)
                this.noCeilingFromSelected();

            const stride = entity.stride();
            if(stride == null){
                draw.toScreenPoint(this.screenFromLocation(entity.x, entity.y, entity.z));
            } else {
                // Entre deux cases : le pas place lui-même le sprite entre les deux.
                draw.toScreenPoint(stride.between(
                    this.screenFromLocation(stride.from.x, stride.from.y, stride.from.z),
                    this.screenFromLocation(stride.to.x, stride.to.y, stride.to.z)));
            }

            const C2D = this.findCaseLocation(entity.x, entity.y, entity.z);
            if(C2D != null) C2D.entitysDraw[C2D.entitysDraw.length] = draw;
        }
    }

    /** Sélectionne une entité et met à jour les plafonds à masquer. */
    select(id){
        this.selected.ID = id ?? "";
        this.noCeilingFromSelected();
        return this.selectedEntity();
    }
    /**
     * Envoie l'entité sélectionnée vers un cube.
     * Renvoie false si rien n'est sélectionné ou si la destination est inaccessible.
     */
    moveSelectedTo(cube){
        if(cube == null || this.map == null) return false;
        const entity = this.selectedEntity();
        if(entity == null) return false;
        return new Pathfinding(entity.x, entity.y, entity.z, this.map)
                    .moveTo(entity, cube.x, cube.y, cube.z);
    }

/**
 * GESTION DE LA CIBLE DE SOURIS AVEC LIMITATION DE PORTÉE
 * Détermine la position et la cible sous le curseur pour les actions avec portée limitée
 * Principalement utilisé pour les AOE (Area of Effect) et pouvoirs à distance
 * 
 * FONCTIONNEMENT :
 * 1. Trouve la position sous le curseur (cube ou terrain)
 * 2. Applique la limitation de portée si une entité est sélectionnée
 * 3. Recherche une cible valide à cette position
 * 4. Met à jour SelectedMouse avec les coordonnées et la cible
 * 
 * TODO: Changer X,Y,Z en Cube et supprimer Target
 */
    onSelectedMouse(){
    // === DÉTERMINATION DE LA POSITION SOUS LE CURSEUR ===
    
        let C2D = this.caseFromMouse();  // Trouve la case 3D sous le curseur
        let x = 0, y = 0, z = 0;
    
        if(C2D != null && C2D.cubes.length > 0 )
        {
        // S'il y a des cubes dans la case, prend le cube le plus haut
            let topCube = C2D.cubes[C2D.cubes.length-1];
            x = topCube.x;
            y = topCube.y;
            z = topCube.z;
        
        // Code désactivé pour les ajustements précis dans la case
        // TODO: Réimplémenter si nécessaire pour la précision sous-pixel
        /*
        if( PageInfo.MapInfo.Adjusted )
        {
            SelectedMouse.Adjustment.X = Math.floor( ((Mouse.X - PageInfo.Frame.X - C3D.Screen.X) / PageInfo.MapInfo.SizeCube)*100 );
            SelectedMouse.Adjustment.Y = Math.floor( ((Mouse.Y - PageInfo.Frame.Y - (C3D.Screen.Y + (PageInfo.MapInfo.SizeCube/2))) / PageInfo.MapInfo.SizeCube)*100 );
        }
        */
        } else {
        // Aucun cube trouvé : utilise la position du terrain à ce niveau
        x = this.location.x + this.case.x;
        y = this.location.y + this.case.y;
        z = this.location.z;
        }
    
        // === APPLICATION DE LA LIMITATION DE PORTÉE ===
    
        if( this.selected.ID != "" && this.selectedMouse.range > 0)
        {
            let entity = this.selectedEntity();  // Entité actuellement sélectionnée
            if(entity != null)
            {
                // Limite la position X dans la portée autorisée
                if(x - entity.x > this.selectedMouse.range)
                    x = entity.x + this.selectedMouse.range;
                else if(x - entity.x < -this.selectedMouse.range)
                    x = entity.x - this.selectedMouse.range;
                
                // Limite la position Y dans la portée autorisée
                if(y - entity.y > this.selectedMouse.range)
                    y = entity.y + this.selectedMouse.range;
                else if(y - entity.y < -this.selectedMouse.range)
                    y = entity.y - this.selectedMouse.range;
                
                // Limite la position Z dans la portée autorisée
                if(z - entity.z > this.selectedMouse.range)
                    z = entity.z + this.selectedMouse.range;
                else if(z - entity.z < -this.selectedMouse.range)
                    z = entity.z - this.selectedMouse.range;
            }
        }

        // === MISE À JOUR DES COORDONNÉES FINALES ===
    
        this.selectedMouse.x = x;
        this.selectedMouse.y = y;
        this.selectedMouse.z = z;

        // === RECHERCHE D'UNE CIBLE À CETTE POSITION ===
    
        if(this.map == null) return;
    
        this.selectedMouse.target = "";  // Réinitialise la cible
        let target = null;
    
        // D'abord les décors ciblables, puis les mobiles (un bâtiment masque un perso au même cube).
        const permanents = this.map.permanents;
        for( let p = 0; p < permanents.length; p++)
            if( permanents[p] != null && 
                permanents[p].canTarget && 
                this.contains_Entity(permanents[p], this.selectedMouse.x, this.selectedMouse.y, this.selectedMouse.z) )
                target = permanents[p];
    
        if(target == null){
            const mobiles = this.mobiles();
            for( let t = 0; t < mobiles.length; t++)
                if( mobiles[t] != null && 
                    mobiles[t].canTarget && 
                    this.contains_Entity(mobiles[t], this.selectedMouse.x, this.selectedMouse.y, this.selectedMouse.z) )
                target = mobiles[t];
        }
    
        if(target != null){
            this.selectedMouse.target = target.id;
        } else {
            // Pas de hit 3D : rectangle sprite (utile si le volume voxel est petit).
            const mouse = this.mouseFromScreen();
            let mx = mouse.x;
            let my = mouse.y;
        
            for(let i = 0; i < this.entitysDraw.length; i++){
                if(this.entitysDraw[i].screen.x < mx && 
                   mx < this.entitysDraw[i].screen.x + this.entitysDraw[i].width && 
                   this.entitysDraw[i].screen.y < my && 
                   my < this.entitysDraw[i].screen.y + this.entitysDraw[i].height){
                    this.selectedMouse.target = this.entitysDraw[i].id;
                    break;
                }
            }
        }
    };
/**
 * GESTION DE LA CIBLE PRINCIPALE SOUS LE CURSEUR
 * Met à jour l'objet Target avec la case, le cube et l'entité sous le curseur
 * Utilisé pour les interactions directes (clic, sélection, mouvement)
 * 
 * FONCTIONNEMENT :
 * 1. Trouve la case 3D sous le curseur
 * 2. Identifie le cube "sol" de cette case
 * 3. Recherche une entité par collision 2D à l'écran
 * 4. Met à jour les références dans l'objet Target global
 */
    onTarget(){
        let C2D = this.findCase(this.case.x, this.case.y);
        this.target.case = C2D;
    
        // Sol = cube traversable le plus haut de la colonne (CaseIso.toFloors).
        if(C2D != null) 
            this.target.cube = C2D.toFloors();
        else 
            this.target.cube = null;
    
        this.target.id = "";
    
        // Les décors sont ciblables aussi : un arbre ou un bâtiment se clique.
        const temp_EntitysDraw = this.permanentsDraw.concat(this.entitysDraw);
        const mouse = this.mouseFromScreen();
        let mx = mouse.x;
        let my = mouse.y;
        for(let d = 0; d < temp_EntitysDraw.length; d++){
            if(temp_EntitysDraw[d].screen.x < mx && 
                mx < temp_EntitysDraw[d].screen.x + temp_EntitysDraw[d].width && 
                temp_EntitysDraw[d].screen.y < my && 
                my < temp_EntitysDraw[d].screen.y + temp_EntitysDraw[d].height){
                this.target.id = temp_EntitysDraw[d].id;
                break;
            }
        }
    };
/**
 * DÉMARRAGE DE LA SÉLECTION MULTIPLE (GLISSER-DÉPOSER)
 * Initialise une sélection multiple quand l'utilisateur appuie sur le bouton de la souris
 * Crée un rectangle de sélection qui s'étendra jusqu'au relâchement
 */
    selectedMulti_Down(){
        const multi = this.selectedMulti;
        const inside = this.mouseFromScreen();
        multi.Active = true;
        this.selected.Multi = [];
        // Coin départ du rectangle, relatif au contrôle (pas au formulaire).
        multi.Source.X = inside.x;
        multi.Source.Y = inside.y;
        multi.Destination.X = inside.x;
        multi.Destination.Y = inside.y;
    };
    selectedMulti_Up(){
        this.selectedMulti.Active = false;
    };
    /** Recalcule selected.Multi : toute EntityDraw dont le sprite coupe le rectangle. */
    selectedMulti_Move(){
        const selected = this.selected;
        const multi = this.selectedMulti;
        const inside = this.mouseFromScreen();
        selected.Multi = [];
        multi.Destination.X = inside.x;
        multi.Destination.Y = inside.y;

        for (let i = 0; i < this.entitysDraw.length; i++){
            const draw = this.entitysDraw[i];
            if(multi.Source.X < multi.Destination.X){
            if(draw.screen.x > multi.Destination.X) continue;
            if(draw.screen.x + draw.width < multi.Source.X) continue;
            }
            else if(multi.Source.X > multi.Destination.X){
            if(draw.screen.x > multi.Source.X) continue;
            if(draw.screen.x + draw.width < multi.Destination.X) continue;
            }
        
            if(multi.Source.Y < multi.Destination.Y){
            if(draw.screen.y > multi.Destination.Y) continue;
                if(draw.screen.y + draw.width < multi.Source.Y) continue;
            }
            else if(multi.Source.Y > multi.Destination.Y){
                if(draw.screen.y > multi.Source.Y) continue;
                if(draw.screen.y + draw.width < multi.Destination.Y) continue;
            }
        
            selected.Multi[selected.Multi.length] = draw.id;
        }
    }

/**
 * RACCOURCI : Obtient l'entité actuellement sélectionnée
 * @returns {Object|null} L'objet entité sélectionnée ou null si aucune sélection
 */
    selectedEntity(){ return this.findEntityID(this.selected.ID); };
    selected_Entity(){ return this.selectedEntity(); };
    selectedTarget(){ return this.findEntityID(this.selected.Target); };
    selected_Target(){ return this.selectedTarget(); };
    /**
     * Point 3D dans le volume d'une entité.
     * Délègue à Entity.contains ; sinon lit width/x camelCase ou PascalCase.
     */
    contains_Entity(entity, pX, pY, pZ){
        if(entity == null) return false;
        if(typeof entity.contains === "function") return entity.contains(pX, pY, pZ);
        const width = entity.width ?? entity.Width;
        const height = entity.height ?? entity.Height;
        const x = entity.x ?? entity.X;
        const y = entity.y ?? entity.Y;
        const z = entity.z ?? entity.Z;
        return (pX <= x) && (pX > x - width)
        && (pY <= y) && (pY > y - width)
        && (pZ >= z) && (pZ < z + height);
    };
    /**
     * Recalcule les pièces dont il faut masquer le plafond, d'après l'entité
     * sélectionnée. Aucune sélection = on remet tous les plafonds.
     */
    noCeilingFromSelected(){
        const entity = this.selectedEntity();
        if(entity == null) this.#noCeiling = [];
        else this.noCeilingFrom(entity.x, entity.y, entity.z);
    };
    /** Pièces contenant ce point : c'est la carte qui sait, on lui demande. */
    noCeilingFrom(x, y, z){
        this.#noCeiling = this.map == null ? [] : this.map.zonesAt(x, y, z);
        this.#createCubes = true;
    };
    /** Ce cube fait-il partie d'un plafond à masquer ? wallCeil décide du sort des murs. */
    containsNoCeiling(x, y, z){
        for(let i = 0; i < this.#noCeiling.length; i++)
            if(this.#noCeiling[i].hides(x, y, z, this.#wallCeil)) return true;
        return false;
    };
    /**
     * Cube du monde. On demande à la carte au lieu de fouiller sa grille :
     * MapView ignore ainsi comment les cubes sont rangés, et pourra afficher
     * aussi bien une carte unique qu'un assemblage de cartes.
     */
    findCube(x, y, z){
        if(this.map == null) return null;
        return this.map.cubeAt(x, y, z);
    };
    /** Ce point fait-il partie du monde ? (différent de « la donnée est chargée »). */
    contains_Map(pX, pY, pZ, map = this.map){
        if(map == null) return false;
        return map.inBounds(pX, pY, pZ);
    };
    /** Case du viewport (losange affiché), pas un cube monde. */
    findCase(x, y){
        for(let i = 0; i < this.cases.length; i++)
            if ( this.cases[i].x == x && this.cases[i].y == y)
                return this.cases[i];
        return null;    
    };
    /** Monde → case caméra (même parallaxe que screenFromLocation). */
    findCaseLocation(x, y, z){
        x = x - this.location.x - (z - this.location.z);
        y = y - this.location.y - (z - this.location.z);
        return this.findCase(x,y);
    };
    /** Habitants de la carte d'abord, puis les entités propres à cette vue. */
    findEntityID(id){
        if(id == null || id === "") return null;

        if(this.map != null){
            const entity = this.map.findEntity(id);
            if(entity != null) return entity;
        }

        for( let ent = 0; ent < this.entitys.length; ent++)
            if( id == this.entitys[ent].id )
                return this.entitys[ent];
    
        return null;
    };

};
