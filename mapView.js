import { Core } from 'Control/core.js';
import { CoreIso } from './coreIso.js';
import { Form, DrawForm, FactoryForm } from 'Control/form.js';
import { Control } from 'Control/control.js';
import { Draw } from 'Control/draw.js'; 
import { Factory } from 'Control/factory.js'
import { Mouse } from 'Control/input.js';
import { Resize, Scale } from 'Control/transformation.js';
import { CaseIso } from './caseIso.js';
import { PaintIso } from './paintIso.js';
import { Textures } from './textureIso.js';
import { EntityDraw } from './entitydraw.js';
import { Pathfinding } from './Pathfinding.js';
import { Point, Location, CasePoint } from './pointIso.js';

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

export class DrawMapView extends Draw {

    #paintIso = null;
    //showGrid / showNumbers : repères de mise au point, à activer depuis l'éditeur.
    #showGrid = false;
    #showNumbers = false;
    //showHover : losange rouge sur la case survolée.
    #showHover = true;

    constructor(control){
        super(control);
    }

    get showGrid(){ return this.#showGrid; }
    set showGrid(value){ this.#showGrid = !!value; }
    get showNumbers(){ return this.#showNumbers; }
    set showNumbers(value){ this.#showNumbers = !!value; }
    get showHover(){ return this.#showHover; }
    set showHover(value){ this.#showHover = !!value; }

    /** Le Paint peut changer (le contrôle peut changer de formulaire) : on resynchronise. */
    get PaintIso(){
        if(this.#paintIso == null) this.#paintIso = new PaintIso(this.Paint);
        else this.#paintIso.paint = this.Paint;
        return this.#paintIso;
    }

    draw(){
        super.draw();

        this.drawMap();

        if(this.#showGrid) this.drawGrid();
        if(this.#showNumbers) this.drawCaseNumbers();
        if(this.#showHover) this.drawLosange(this.control.case.x, this.control.case.y);
    }

    /**
     * Le monde, du fond vers l'avant.
     *
     * On monte étage par étage, et dans chaque étage on pose d'abord tous les
     * sols puis tous les volumes. C'est cet ordre qui fait qu'un mur cache bien
     * ce qui est derrière lui : le peintre couvre au fur et à mesure.
     */
    drawMap(){
        const control = this.control;
        if(control.map == null) return;

        const paintIso = this.PaintIso;
        const size = control.sizeCase;
        const grap = control.grap;

        for(let z = 0; z <= control.maxZ; z++){
            this.drawFloors(paintIso, z, size, grap);
            this.drawVolumes(paintIso, z, size, grap);
        }
    }

    drawFloors(paintIso, z, size, grap){
        const cases = this.control.cases;
        for(let c = 0; c < cases.length; c++){
            const C2D = cases[c];
            const x = C2D.screen.x + grap.x;
            const y = C2D.screen.y + grap.y;

            if(C2D.cubes.length == 0){
                if(z == 0) this.drawDefault(paintIso, x, y, size);
                continue;
            }
            for(let i = 0; i < C2D.cubes.length; i++){
                const cube = C2D.cubes[i];
                if(cube != null && cube.z == z)
                    this.drawLayer(paintIso, cube.floors, cube.floorsSpeed, x, y, size, false);
            }
        }
    }

    drawVolumes(paintIso, z, size, grap){
        const cases = this.control.cases;
        for(let c = 0; c < cases.length; c++){
            const C2D = cases[c];
            const x = C2D.screen.x + grap.x;
            const y = C2D.screen.y + grap.y;

            for(let i = 0; i < C2D.cubes.length; i++){
                const cube = C2D.cubes[i];
                if(cube != null && cube.z == z)
                    this.drawLayer(paintIso, cube.volumes, cube.volumesSpeed, x, y, size, true);
            }
            // Les entités s'intercalent entre les volumes du même étage.
            for(let d = 0; d < C2D.entitysDraw.length; d++)
                if(C2D.entitysDraw[d].z == z)
                    this.drawEntity(paintIso, C2D.entitysDraw[d], grap);
        }
    }

    /** Sol de repère là où la carte est vide : indispensable pour éditer dans le vide. */
    drawDefault(paintIso, x, y, size){
        this.drawLayer(paintIso, this.control.floorsDefault, 0, x, y, size, false);
    }

    /**
     * Empile les textures d'une couche sur une case.
     * speed > 0 : le lot est une animation, on n'affiche qu'une image, choisie
     * d'après l'horloge, ce qui synchronise toutes les cases entre elles.
     */
    drawLayer(paintIso, names, speed, x, y, size, volume){
        if(names == null || names.length == 0) return;

        const rectY = volume ? y - size : y;
        const rectHeight = volume ? size * 2 : size;

        if(speed > 0){
            const i = Math.floor(names.length * ((Date.now() % speed) / speed));
            this.drawTexture(paintIso, names[i], x - size, rectY, size * 2, rectHeight);
            return;
        }
        for(let i = 0; i < names.length; i++)
            this.drawTexture(paintIso, names[i], x - size, rectY, size * 2, rectHeight);
    }

    drawTexture(paintIso, name, x, y, width, height){
        const texture = Textures.get(name);
        if(texture == null) return;
        texture.draw(paintIso, x, y, width, height);
    }

    /** Le rectangle du sprite est déjà calculé par EntityDraw : on le remplit. */
    drawEntity(paintIso, entityDraw, grap){
        this.drawTexture(paintIso, entityDraw.body,
            entityDraw.screen.x + grap.x, entityDraw.screen.y + grap.y,
            entityDraw.width, entityDraw.height);
    }
    drawGrid(){
        const paint = this.Paint;
        const control = this.control;
        const rect = control.Rectangle.rectangleBackground();
        const ctx = paint.context;
        const sizeCase = control.sizeCase;
        const nbrCases = control.nbrCases-1;
        const maxCases = (control.nbrCases*2)-1;

        const color = "#043296ff";
        const lineWidth = 2;

        for( let x = 0; x <= nbrCases; x++){
            let from = control.screenFromCase(x, 0-x);
            let to = control.screenFromCase(maxCases-x, 0-x);
            paint.drawLine(from.x, from.y, to.x, to.y, color, lineWidth);
            
            from = control.screenFromCase(x, x+1);
            to = control.screenFromCase(maxCases-x, x+1);
            paint.drawLine(from.x, from.y, to.x, to.y, color, lineWidth);

            from = control.screenFromCase(x, 0-x);
            to = control.screenFromCase(x, x+1);
            paint.drawLine(from.x, from.y, to.x, to.y, color, lineWidth);

            from = control.screenFromCase(nbrCases+x+1, 0-(nbrCases-x));
            to = control.screenFromCase(nbrCases+x+1, nbrCases+1-x);
            paint.drawLine(from.x, from.y, to.x, to.y, color, lineWidth);
        }
        //paint.borderRectangle(rect.x, rect.y, rect.width, rect.height, "black", 2);
    }
    drawCaseNumbers(){
        const control = this.control;
        const paint = this.Paint;
        const sizeCase = control.sizeCase;
        const nbrCases = control.nbrCases;
        const maxCases = (control.nbrCases*2);
        const font = { family: "Arial", size: 10, style: "bold", color: "#000" };
        
        for(let x = 0-maxCases; x <= maxCases; x++){
            for(let y = 0-maxCases; y <= maxCases; y++){
                let c = control.screenFromCase(x, y);
                const abs = Math.abs(x)+Math.abs(y);
                //if(x - y >= -2 && x + y >= -2 && abs <= nbrCases*2){
                
                //if( x+y < -2 || x+y > nbrcube*2 || x-y < -1 || x-y > nbrcube*2+1 )continue;
                if(x - y >= -2 && x + y >= -2 && abs <= maxCases){
                    paint.drawText(c.x-sizeCase/4, c.y+sizeCase/2, `${x},${y}`, font);
                }
            }
        }
    }
    drawGrid2(){
        const paint = this.Paint;
        const control = this.control;
        const ctx = paint.context;
        const sizeCase = control.sizeCase;
        const nbrCasesFrame = control.nbrCases;

        const color = "#2bec05ff";
        const lineWidth = 2;

        for( let x = 0; x <= nbrCasesFrame; x++){
            let from = control.screenFromCase(x, 0-x);
            let to = control.screenFromCase((nbrCasesFrame*2)-x, 0-x);
            paint.drawLine(from.x, from.y, to.x, to.y, color, lineWidth);
            
            from = control.screenFromCase(x, x);
            to = control.screenFromCase((nbrCasesFrame*2)-x, x);
            paint.drawLine(from.x, from.y, to.x, to.y, color, lineWidth);

            from = control.screenFromCase(x, 0-x);
            to = control.screenFromCase(x, x);
            paint.drawLine(from.x, from.y, to.x, to.y, color, lineWidth);

            from = control.screenFromCase(nbrCasesFrame+x, 0-nbrCasesFrame+x);
            to = control.screenFromCase(nbrCasesFrame+x, nbrCasesFrame-x);
            paint.drawLine(from.x, from.y, to.x, to.y, color, lineWidth);
        }
        paint.borderRectangle(control.frame.x, control.frame.y, control.frame.width, control.frame.height, "black", 2);
    }
    drawCaseNumbers2(){
        const control = this.control;
        const paint = this.Paint;
        const sizeCase = control.sizeCase;
        const nbrCasesFrame = control.nbrCases;//Frame();
        const font = { family: "Arial", size: 10, style: "bold", color: "#000" };
        
        for(let x = 0; x <= nbrCasesFrame*2; x++){
            for(let y = 0; y <= nbrCasesFrame*2; y++){
                let c = control.screenFromCase(x, -y);
                if(x + y <= nbrCasesFrame*2 && x - y >= -1 && x !== nbrCasesFrame*2){
                    paint.drawText(c.x, c.y+sizeCase/2, `${x},${y}`, font);
                }
                c = control.screenFromCase(x, y);
                if(x + y <= (nbrCasesFrame*2)-1 && x - y >= 0 && y !== 0){
                    paint.drawText(c.x-5, c.y+sizeCase/2, `${x},${y}`, font);
                }
            }
        }
    }
    drawInfo(){ //SUPPRIMER!!!
        const paint = this.Paint;
        const control = this.control;
        
        const font = { family: "Arial", size: 12, style: "bold", color: "#000" };
        const inside = control.Mouse.inside();
        const c = control.case;
        const nbrCasesFrame = control.nbrCases;
        const sizeCase = control.sizeCase;
        const screen = control.screenFromCase(c.x, c.y);
        const rect = control.Rectangle.rectangleBackground();
        const col = 50;//rect.x + 10;
        const line = 50;//rect.y;
        const space = 15;
        
        paint.drawText(col, line+space, `Inside: ${inside.x}, ${inside.y}`, font);
        paint.drawText(col, line+space*2, `Case: ${c.x}, ${c.y}`, font);
        paint.drawText(col, line+space*3, `Adjustment: ${c.adjustment.x}%, ${c.adjustment.y}%`, font);
        paint.drawText(col, line+space*4, `Nbr cases: ${nbrCasesFrame}`, font);
        paint.drawText(col, line+space*5, `Size case: ${sizeCase}`, font);
        paint.drawText(col, line+space*6, `Screen: ${screen.x}, ${screen.y}`, font);
    }
    /**
     * Surligne la case (cx, cy).
     * Le losange est tracé directement à partir de sa position ; l'ancienne
     * version testait chaque pixel de la fenêtre, soit plus d'un million de
     * conversions par image.
     */
    drawLosange(cx, cy){
        const control = this.control;
        const paintIso = this.PaintIso;
        const size = control.sizeCase;
        const grap = control.grap;

        const C2D = control.findCase(cx, cy);
        const screen = C2D != null ? C2D.screen : control.screenFromCase(cx, cy);
        const x = screen.x + grap.x;
        const y = screen.y + grap.y;

        paintIso.withAlpha(0.35, () => paintIso.fillLosange(x, y, size, "#ff0000"));
        paintIso.strokeLosange(x, y, size, "#ff0000", 2);
    }
}

export class MouseIso extends Mouse{
     constructor(control){
        super(control);
    }
     hover(){
        super.hover();
        const control = this.control;
        if(Core.mousehover.control !== control)return;
        control.case = control.caseFromMouse();
    }
    /**
     * Clic gauche : on désigne un personnage pour le sélectionner, on désigne
     * le sol pour l'y envoyer. C'est la boucle de jeu la plus courante d'un
     * moteur isométrique, et elle tient en quatre lignes.
     */
    clickLeft(){
        super.clickLeft();
        const control = this.control;
        control.case = control.caseFromMouse();
        control.onTarget();

        if(control.target.id !== "") control.select(control.target.id);
        else control.moveSelectedTo(control.target.cube);
    }
    wheel(deltaX, deltaY){
        const control = this.control;
        control.nbrCases = deltaY < 0 ? control.nbrCases -= 1 : control.nbrCases += 1;
    }
}

export class ResizeIso extends Resize{
    constructor(control){
        super(control);    
    }   
    to(width, height=width){
        const control = this.control;
        height = (width - control.Border.left - control.Border.right)/2;
        height += control.Border.top + control.Border.bottom;
        super.to(width, height);
        this.control.modified();
    }
}

export class ScaleIso extends Scale{
    constructor(control){
        super(control);    
    }
    to(ratio_width, ratio_height){
        //super.to(ratio_width, ratio_width/2);
        //this.control.modified();
    }
}


/*
export class FactoryMapView extends Factory {  
    createControl(){ return new MapView(this.createFactoryElement()); }
    createFactoryElement(){ return new FactoryElementIso(); }
    createDraw(control){ return new DrawMapView(control); }
    createMouse(control){ return new MouseIso(control); }
    createResize(control){ return new ResizeIso(control); }
    createScale(control){ return new ScaleIso(control); }
}

export class FactoryElementIso{
    constructor(){}
    createCase(x, y){ return new Case(x, y); }
}
*/