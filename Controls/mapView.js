import { CoreIso } from '../coreIso.js';
import { Control } from 'Control/control.js';
import { EntityDraw } from '../entitydraw.js';
import { Location, CasePoint } from '../pointIso.js';
import { Projector } from './projector.js';
import { Selection } from './selection.js';

export class MapView extends Control{
    //grap : Gestion du déplacement de la vue ("grab" pour saisir/déplacer) 
     #grap = {x:0, y:0, adjustment:{x:0,y:0}, border:25, step:25, modified:false, rolled:0};
    //wallCeil : Mode d'affichage des murs et plafonds
    #wallCeil = 0;

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
    #projector = null;
    #selection = null;

    constructor(){
        super();
        this.#projector = new Projector(this);
        this.#selection = new Selection(this);
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
    get projector(){ return this.#projector; }
    get selection(){ return this.#selection; }
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
    get selected(){ return this.#selection.selected; }
    get target(){ return this.#selection.target; }
    get selectedMulti(){ return this.#selection.selectedMulti; }
    get selectedMouse(){ return this.#selection.selectedMouse; }
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
    redress(){ return this.#projector.redress(); }
    mouseFromScreen(){ return this.#projector.mouseFromScreen(); }
    caseFromMouse(){ return this.#projector.caseFromMouse(); }
    caseFromScreen(x, y){ return this.#projector.caseFromScreen(x, y); }
    screenFromCase(x, y){ return this.#projector.screenFromCase(x, y); }
    caseFromLocation(x, y, z){ return this.#projector.caseFromLocation(x, y, z); }
    screenFromLocation(x, y, z){ return this.#projector.screenFromLocation(x, y, z); }
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

    select(id){ return this.#selection.select(id); }
    moveSelectedTo(cube){ return this.#selection.moveSelectedTo(cube); }
    onSelectedMouse(){ this.#selection.onSelectedMouse(); }
    onTarget(){ this.#selection.onTarget(); }
    selectedMulti_Down(){ this.#selection.selectedMulti_Down(); }
    selectedMulti_Up(){ this.#selection.selectedMulti_Up(); }
    selectedMulti_Move(){ this.#selection.selectedMulti_Move(); }
    selectedEntity(){ return this.#selection.selectedEntity(); }
    selected_Entity(){ return this.#selection.selectedEntity(); }
    selectedTarget(){ return this.#selection.selectedTarget(); }
    selected_Target(){ return this.#selection.selectedTarget(); }
    contains_Entity(entity, pX, pY, pZ){ return this.#selection.contains(entity, pX, pY, pZ); }

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
    /** Monde → case visible, via le projecteur (même parallaxe que l'écran). */
    findCaseLocation(x, y, z){
        const c = this.#projector.caseFromLocation(x, y, z);
        return this.findCase(c.x, c.y);
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
