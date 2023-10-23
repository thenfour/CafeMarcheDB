import React, { Suspense } from "react";
import { modulo } from "shared/utils";
import { Markdown } from "./RichTextEditor";
import { API, HomepageAgendaItemSpec, HomepageContentSpec, HomepageGalleryItemSpec, useFrontpageData } from "../db3/clientAPI";

function logRect(label: string, x?: DOMRect | null) {
    if (!x) {
        console.log(`${label}: --`);
        return;
    }
    console.log(`${label}: [${x.width}, ${x.height}]`);
}

const gSettings = {
    // urlPrefix: `https://cafemarche.be/wp-json/wp/v2/`,
    backstageURL: `/backstage`,//`/backstage/backstage.html`,
    // agendaCategorySlug: "agenda",
    // galleryCategorySlug: "gallery",
    photoCarrouselAutoPlayIntervalMS: 10000,
};

// // window.CMconfig.posts ....
// interface HomepageGalleryItemSpec {
//     descriptionMarkdown: string;
// };
// interface HomepageAgendaItemSpec {
//     titleMarkdown: string;
//     date?: string | null;
//     title?: string | null;
//     location?: string | null;
//     time?: string | null;
//     tags?: string | null;
//     details?: string | null;
// };
// interface HomepageContentSpec {
//     agenda: HomepageAgendaItemSpec[];
//     gallery: HomepageGalleryItemSpec[];
// };

// const gCMContent: HomepageContentSpec = {
//     agenda: [],
//     gallery: [
//         {
//             descriptionMarkdown: "<div>hi</div>",
//         }
//     ],
// };

function InstallOrientationChangeListener(proc) {
    // https://stackoverflow.com/questions/44709114/javascript-screen-orientation-on-safari
    // safari orientation support ...
    if (screen && screen.orientation) {
        screen.orientation.addEventListener('change', proc);
        return;
    }

    var mql = window.matchMedia("(orientation: portrait)");

    // https://www.tabnine.com/code/javascript/functions/builtins/MediaQueryList/addEventListener
    if (mql.addEventListener) {
        mql.addEventListener('change', proc);
    } else if (mql.addListener) {
        mql.addListener(proc);
    }

    console.log(`No way to detect orientation change.`);
}



//window.CMevents = new EventTarget();

// const gSettings = {
//     urlPrefix: `https://cafemarche.be/wp-json/wp/v2/`,
//     backstageURL: `https://backstage.cafemarche.be`,//`/backstage/backstage.html`,
//     agendaCategorySlug: "agenda",
//     galleryCategorySlug: "gallery",
//     photoCarrouselAutoPlayIntervalMS: 10000,
// };

// function PostMatchesCategorySlug(post, slug) {
//     // find the category term
//     return !!post._embedded["wp:term"].find(term => {
//         return !!term.find(t2 => t2.taxonomy === 'category' && t2.slug === slug);
//     });
// }

// if an image is not relevant yet, don't provide the URL.
// otherwise, when the page loads, ALL GALLERY IMAGES attempt to preload at once,
// and the single one that's actually visible is probably going to take MUCH longer
// than it needs to.
// function GetFeaturedImageSource(post) {
//     if (!post.CMRelevant) return "#";
//     if (!post._embedded) return "#";
//     if (!post._embedded['wp:featuredmedia']) return "#";
//     if (post._embedded['wp:featuredmedia'].length < 1) return "#";
//     if (!post._embedded['wp:featuredmedia'][0].media_details) return "#";
//     if (!post._embedded['wp:featuredmedia'][0].media_details.sizes) return "#";
//     if (post._embedded['wp:featuredmedia'][0].media_details.sizes.large) {
//         return post._embedded['wp:featuredmedia'][0].media_details.sizes.large.source_url;
//     }
//     return post._embedded['wp:featuredmedia'][0].media_details.sizes.full.source_url;
// }

function GetImageURI(post: HomepageGalleryItemSpec): string {
    return "/images/card.jpg";
}

class Gallery {

    //posts: HomepageGalleryItemSpec[];
    private selectedIdx: number; // may be out of bounds; modulo when accessing.
    ab: boolean;
    content: HomepageContentSpec | null;

    constructor() {
        // TODO
        // this.posts = window.CMconfig.posts.filter(p => PostMatchesCategorySlug(p, gSettings.galleryCategorySlug));// p.categories.find(c => c === this.category.id));
        //this.posts = gCMContent.gallery;

        this.content = null;
        this.selectedIdx = (Math.random() * 1000) | 0;

        // is there a "show first always" priority image?
        // const firstStickyIndex = this.posts.findIndex(p => p.sticky);
        // if (firstStickyIndex !== -1) {
        //     this.selectedIdx = firstStickyIndex;
        // }

        //this.posts[this.selectedIdx]!.CMRelevant = true;
        //this.posts[modulo(this.selectedIdx, this.posts.length)]!.CMRelevant = true;

        this.ab = false; // to swap A and B for transitioning
    }

    setContent(content: HomepageContentSpec | null) {
        this.content = content;
    };

    applyStateToDOM() {
        if (!this.content) return;
        if (this.content.gallery.length < 1) return;

        const posts = this.content.gallery;
        const indexInRange = this.bringIndexIntoRange(this.selectedIdx);
        const post = this.content.gallery[indexInRange]!;
        const nextPostID = this.bringIndexIntoRange(this.selectedIdx + 1);
        const nextPost = posts[nextPostID]!;

        document.getElementById(`galleryPatternImage${indexInRange}`)!.setAttribute('href', GetImageURI(post));
        document.getElementById(`galleryPatternImage${nextPostID}`)!.setAttribute('href', GetImageURI(nextPost));

        const a = document.getElementById(this.ab ? "galleryPhoto2" : "galleryPhoto1")!;
        const b = document.getElementById(this.ab ? "galleryPhoto1" : "galleryPhoto2")!;

        a.setAttribute("fill", `url(#galleryPattern${indexInRange})`);

        const photoSelector = document.querySelector("#photoSelectContainer ul#photoSelector");
        if (photoSelector) {
            (photoSelector as HTMLElement).style.setProperty("--count", `${posts.length}`);
        }

        a.style.opacity = "100%";
        b.style.opacity = "0%";
    }

    getSelectedPost(): HomepageGalleryItemSpec | null {
        if (!this.content) return null;
        return this.content.gallery[this.bringIndexIntoRange(this.selectedIdx)]!;
    }

    getSelectedIndex(): number {
        return this.bringIndexIntoRange(this.selectedIdx);
    }

    bringIndexIntoRange(index: number): number {
        if (!this.content) return index;
        if (this.content.gallery.length < 1) return index; // nothing will be displayed anyway.
        return modulo(this.selectedIdx, this.content.gallery.length);
    }

    setSelectedIdx(idx) {
        this.selectedIdx = idx;
        this.ab = !this.ab;
        this.applyStateToDOM();
    }

}


/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
interface AgendaItemProps {
    item: HomepageAgendaItemSpec;
};

class AgendaItem extends React.Component<AgendaItemProps> {

    constructor(props: AgendaItemProps) {
        super(props);
        this.state = {};
    }

    render() {
        const post = this.props.item;
        return (<div className="agendaPost">
            {!!post.date && <div className="agendaDate">{post.date}</div>}
            {!!post.title && <div className="agendaTitle">{post.title}</div>}
            {!!post.location && !!post.locationURI && <a target="_blank" href={post.locationURI}><div className="agendaLocation"><i className="material-icons">pin_drop</i>{post.location}</div></a>}
            {!!post.location && !post.locationURI && <div className="agendaLocation"><i className="material-icons">pin_drop</i>{post.location}</div>}
            {!!post.time && <div className="agendaTime"><i className="material-icons">access_time</i>{post.time}</div>}
            {!!post.tags && <div className="agendaTags">{post.tags}</div>}
            {!!post.detailsMarkdown && <Markdown markdown={post.detailsMarkdown} className="agendaDetails" />}

        </div>
        );
    }
}

const TopRight = () => {
    return <div id="svgtoprighttitle">
        <svg width="400" height="400" xmlns="http://www.w3.org/2000/svg">
            <rect width="100%" height="100%" fill="#fff" />

            {/* <!-- Title --> */}
            <text id="subtitle1" x="20" y="30" font-size="24">
                NO-NONSENSE ALL STYLE ORCHESTRA FROM BRUXL
            </text>

            {/* <!-- Subtitle 2 --> */}
            <text x="20" y="90" font-size="18" font-family="Arial" fill="#000">
                BOOK US! PLAY WITH US! COME SEE US!
            </text>

            {/* <!-- Social Icons --> */}
            <a href="https://www.instagram.com/cafemarche_bxl/" target="_blank">
                <rect x="220" y="30" width="40" height="40" fill="#405DE6" />
                {/* <!-- Add the Instagram logo path here --> */}
            </a>

            <a href="https://www.facebook.com/orkest.cafe.marche/" target="_blank">
                <rect x="270" y="30" width="40" height="40" fill="#1877F2" />
                {/* <!-- Add the Facebook logo path here --> */}
            </a>

            <a href="mailto:cafemarche@cafemarche.be">
                <rect x="320" y="30" width="40" height="40" fill="#000">
                    {/* <!-- Add the email image or icon here --> */}
                </rect>
            </a>
        </svg></div>;
};

const TopRight2 = () => {
    return <div id="toprighttitle">
        {/* <div id="subtitle1"><span className="nowrap">NO-NONSENSE ALL STYLE&nbsp;</span><span className="nowrap">ORCHESTRA FROM BRUXL</span></div> */}
        <div id="subtitle1"><span className="nowrap">NO-NONSENSE&nbsp;ALL&nbsp;STYLE ORCHESTRA FROM&nbsp;BRUXL</span></div>
        <div id="subtitle2">
            <span className="nowrap">BOOK&nbsp;US! PLAY&nbsp;WITH&nbsp;US! COME&nbsp;SEE&nbsp;US!</span>

            <div id='socicons'>
                {/* from https://simpleicons.org/ */}
                <a title="Instagram" href="https://www.instagram.com/cafemarche_bxl/" target="_blank">
                    <svg className="socicon" role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><title>Instagram</title><path d="M12 0C8.74 0 8.333.015 7.053.072 5.775.132 4.905.333 4.14.63c-.789.306-1.459.717-2.126 1.384S.935 3.35.63 4.14C.333 4.905.131 5.775.072 7.053.012 8.333 0 8.74 0 12s.015 3.667.072 4.947c.06 1.277.261 2.148.558 2.913.306.788.717 1.459 1.384 2.126.667.666 1.336 1.079 2.126 1.384.766.296 1.636.499 2.913.558C8.333 23.988 8.74 24 12 24s3.667-.015 4.947-.072c1.277-.06 2.148-.262 2.913-.558.788-.306 1.459-.718 2.126-1.384.666-.667 1.079-1.335 1.384-2.126.296-.765.499-1.636.558-2.913.06-1.28.072-1.687.072-4.947s-.015-3.667-.072-4.947c-.06-1.277-.262-2.149-.558-2.913-.306-.789-.718-1.459-1.384-2.126C21.319 1.347 20.651.935 19.86.63c-.765-.297-1.636-.499-2.913-.558C15.667.012 15.26 0 12 0zm0 2.16c3.203 0 3.585.016 4.85.071 1.17.055 1.805.249 2.227.415.562.217.96.477 1.382.896.419.42.679.819.896 1.381.164.422.36 1.057.413 2.227.057 1.266.07 1.646.07 4.85s-.015 3.585-.074 4.85c-.061 1.17-.256 1.805-.421 2.227-.224.562-.479.96-.899 1.382-.419.419-.824.679-1.38.896-.42.164-1.065.36-2.235.413-1.274.057-1.649.07-4.859.07-3.211 0-3.586-.015-4.859-.074-1.171-.061-1.816-.256-2.236-.421-.569-.224-.96-.479-1.379-.899-.421-.419-.69-.824-.9-1.38-.165-.42-.359-1.065-.42-2.235-.045-1.26-.061-1.649-.061-4.844 0-3.196.016-3.586.061-4.861.061-1.17.255-1.814.42-2.234.21-.57.479-.96.9-1.381.419-.419.81-.689 1.379-.898.42-.166 1.051-.361 2.221-.421 1.275-.045 1.65-.06 4.859-.06l.045.03zm0 3.678c-3.405 0-6.162 2.76-6.162 6.162 0 3.405 2.76 6.162 6.162 6.162 3.405 0 6.162-2.76 6.162-6.162 0-3.405-2.76-6.162-6.162-6.162zM12 16c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4zm7.846-10.405c0 .795-.646 1.44-1.44 1.44-.795 0-1.44-.646-1.44-1.44 0-.794.646-1.439 1.44-1.439.793-.001 1.44.645 1.44 1.439z" /></svg>
                </a>

                <a title="Facebook" href="https://www.facebook.com/orkest.cafe.marche/" target="_blank">
                    <svg className="socicon" role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><title>Facebook</title><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" /></svg>
                </a>

                <a title="Email" href="mailto:cafemarche@cafemarche.be">
                    <svg className="socicon" role="img" viewBox="0 0 300 221" xmlns="http://www.w3.org/2000/svg">
                        <image width="300" height="221" href="/homepage/CMmail.png" preserveAspectRatio="xMidYMid slice" />
                    </svg>
                </a>

            </div>


        </div>

    </div>

};




/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export interface HomepageMainProps {
    content: HomepageContentSpec;
};
export class HomepageMain extends React.Component<HomepageMainProps> {

    gallery: Gallery;
    content: HomepageContentSpec;
    mounted: boolean;
    galleryTimer: NodeJS.Timeout | null;

    constructor(props: HomepageMainProps) {
        super(props);
        this.content = props.content;
        this.gallery = new Gallery();
        this.gallery.setContent(props.content);
        this.mounted = false;
        this.galleryTimer = null;
    }

    onWindowResize = (e) => {
        this.updateLayout();
    }

    componentDidMount() {
        window.addEventListener("resize", this.onWindowResize);

        InstallOrientationChangeListener(this.onWindowResize);

        setTimeout(() => this.updateLayout(), 1);
        this.mounted = true;
        this.galleryTimer = setTimeout(this.galleryTimerProc, gSettings.photoCarrouselAutoPlayIntervalMS);

        setTimeout(this.correctTriangleWrappedText, 18);
    }

    componentWillUnmount() {
        window.removeEventListener("resize", this.onWindowResize);
        this.mounted = false;
    }

    updateLayout = () => {
        setTimeout(() => { // necessary to let the browser shuffle the layout.
            this.correctLayoutFromRef('photoCaptionRef', 'photoCaptionContainer', 'middleContent');
            this.correctLayoutFromRef('photoSelectRef', 'photoSelectContainer', 'middleContent');
            this.correctLayoutFromRef('agendaRef', 'agendaContent', 'middleContent');
            this.setState({});
            this.gallery.applyStateToDOM();
        }, 50);
    }

    onSelectPhoto = (i) => {
        this.gallery.setSelectedIdx(i);

        // reset timer
        if (this.galleryTimer) {
            clearTimeout(this.galleryTimer);
        }
        this.galleryTimer = setTimeout(this.galleryTimerProc, gSettings.photoCarrouselAutoPlayIntervalMS);
        this.setState({});
    }

    onClickPhotoNext = () => {
        this.gallery.setSelectedIdx(this.gallery.getSelectedIndex() + 1);
        this.setState({});
    }

    onClickPhotoBack = () => {
        this.gallery.setSelectedIdx(this.gallery.getSelectedIndex() - 1);
        this.setState({});
    }

    galleryTimerProc = () => {
        if (!this.mounted) return;
        this.onClickPhotoNext();
        this.galleryTimer = setTimeout(this.galleryTimerProc, gSettings.photoCarrouselAutoPlayIntervalMS);
    }


    // given a <foreignObject> reference
    // and a target DOM element,
    // and a common relative-position parent,
    // set the DOM element to the position of the foreignObject. Can't just embed directly in the foreignObject because
    // the scaling & filters will make things very unpredictable, and that behavior is getting very fringe and not unified across modern browsers.
    //
    // the target DOM element must be position:absolute.
    correctLayoutFromRef = (refID, targetID, commonID) => {
        const refel = document.getElementById(refID);
        if (!refel) return;
        const trgel = document.getElementById(targetID);
        if (!trgel) return;
        const commonParent = document.getElementById(commonID);
        if (!commonParent) return;
        const rc = refel.getBoundingClientRect();
        const rcp = commonParent.getBoundingClientRect();
        trgel.style.left = (rc.left - rcp.left) + "px";
        trgel.style.top = (rc.top - rcp.top) + "px";
        trgel.style.height = (rc.height) + "px";
        trgel.style.width = (rc.width) + "px";
        //console.log(`set to [${trgel.style.getPropertyValue('--left')}, ${trgel.style.getPropertyValue('--top')}] - [${trgel.style.getPropertyValue('--height')}, ${trgel.style.getPropertyValue('--width')}]`);
    }

    correctTriangleWrappedText = () => {
        const containerHeight = document.getElementById('photoCaptionContainer')?.offsetHeight;
        if (!containerHeight) return;
        const textContainer = document.getElementById('photoCaption');
        if (!textContainer) return;

        textContainer.style.paddingTop = "0px";
        let paddingPx = 0;

        // this is not an exact science. changing the padding means the height can change.
        // a reasonable compromise is to just do it a few times, letting the browser re-layout each time.
        // hopefully we settle somewhere reasonable.

        for (var i = 0; i < 3; ++i) {
            var oldHeight = textContainer.offsetHeight - paddingPx;
            paddingPx = (containerHeight - oldHeight);
            textContainer.style.paddingTop = paddingPx + "px";
        }
    };

    render() {

        const photoSelector = (
            <ul id="photoSelector">
                {this.content.gallery.map((post, i) => (
                    <li key={i} onClick={() => this.onSelectPhoto(i)}>
                        <svg viewBox="-25 -25 350 350" preserveAspectRatio="xMidYMid meet" className={"photoSelectHex" + (i === this.gallery.getSelectedIndex() ? " selected" : "")} >
                            <polygon className="photoSelectHexShape1" points="150,300 280,225 280,75 150,0 20,75 20,225"></polygon>
                            <polygon className="photoSelectHexShape2" points="150,300 280,225 280,75 150,0 20,75 20,225"></polygon>
                        </svg>
                    </li>
                ))}
            </ul>
        );

        const galleryPatternDefs = (
            <defs>
                {
                    this.content.gallery.map((post, idx) => {
                        //if (!post.CMRelevant) return null;
                        let wpimagesource = GetImageURI(post);

                        // preserving aspect ratio of these:
                        // https://stackoverflow.com/questions/22883994/crop-to-fit-an-svg-pattern
                        return (
                            <pattern key={idx} id={`galleryPattern${idx}`} height="100%" width="100%" patternContentUnits="objectBoundingBox" viewBox="0 0 1 1" preserveAspectRatio="xMidYMid slice">
                                <image height="1" width="1" href={wpimagesource} id={`galleryPatternImage${idx}`} preserveAspectRatio="xMidYMid slice" />
                            </pattern>
                        );
                    })
                }
            </defs>
        );

        //const agendaCatID = window.CMconfig.categories.find(c => c.slug === gSettings.agendaCategorySlug).id;
        // const agendaPosts = window.CMconfig.posts.filter(p => PostMatchesCategorySlug(p, gSettings.agendaCategorySlug));// !!p.categories.find(c => c === agendaCatID));
        const agendaBody = this.content.agenda.map((p, i) => {
            //console.log(`rendering agenda item ${p}, ${i}`);
            return <AgendaItem key={i} item={p} />;
        });
        //const agendaBody = <div>TODO: agenda</div>;

        const bothSvgParams = {
            landscape: {
                svgViewBox: "0 0 2072 1496",
            },
            portrait: {
                svgViewBox: "0 0 1086 2200",
            }
        }

        const svgParams = (window.innerHeight < window.innerWidth) ? bothSvgParams.landscape : bothSvgParams.portrait;

        setTimeout(this.correctTriangleWrappedText, 18);

        return (
            <div id="root2" className="widthConstraint">
                <div id="headerchrome" className="widthConstraint">
                    <TopRight2 />
                </div>

                <div id="middleContent" className="widthConstraint">

                    <div id="galleryContainer">
                        <svg viewBox={svgParams.svgViewBox} preserveAspectRatio="xMidYMid meet">
                            {galleryPatternDefs}
                            {(window.innerHeight < window.innerWidth) ? // landscape
                                (<g>
                                    <polygon points="894,385 2106,296 2020,1398 1074,1496" id="agendaBack" />
                                    <polygon points="1089,383 2072,383 2072,1438 1089,1438" id="agendaBack2" />
                                    <polygon points="0,1136 541,1447 0,1398" id="galleryOrange" />
                                    <polygon points="541,187 628,176 1086,502" id="galleryPink" />
                                    <polygon points="628,176 663,173 1086,502" id="galleryBlue" />
                                    <polygon points="0,499 541,187 1086,502 1086,1132 541,1447 0,1136" fill="none" id="galleryPhoto1" />
                                    <polygon points="0,499 541,187 1086,502 1086,1132 541,1447 0,1136" fill="none" id="galleryPhoto2" />
                                    <image width="330" height="330" href="/homepage/CMlogo.png" preserveAspectRatio="xMinYMin slice"></image>
                                    <foreignObject x="0" y="1136" width="541" height="262" id="photoCaptionRef">
                                    </foreignObject>
                                    <foreignObject x="0" y="499" width="1086" height="637" id="photoSelectRef">
                                    </foreignObject>
                                    <foreignObject x="1089" y="383" width="983" height="1055" id="agendaRef">
                                    </foreignObject>
                                </g>) :
                                (<g>
                                    <polygon points="0,385 1064,296 978,1398 32,1496" id="agendaBack" transform="translate(0 474)" />
                                    <polygon points="47,837 1030,837 1030,1892 47,1892" id="agendaBack2" transform="translate(0 20)" />
                                    <polygon points="0,1136 541,1447 0,1398" id="galleryOrange" />
                                    <polygon points="541,187 628,176 1086,502" id="galleryPink" />
                                    <polygon points="628,176 663,173 1086,502" id="galleryBlue" />
                                    <polygon points="0,499 541,187 1086,502 1086,1132 541,1447 0,1136" fill="url(#galleryPhotoSrc1)" id="galleryPhoto1" />
                                    <polygon points="0,499 541,187 1086,502 1086,1132 541,1447 0,1136" fill="url(#galleryPhotoSrc2)" id="galleryPhoto2" />
                                    <image width="330" height="330" href="/homepage/CMlogo.png" preserveAspectRatio="xMinYMin slice"></image>
                                    <foreignObject x="0" y="1136" width="541" height="262" id="photoCaptionRef">
                                    </foreignObject>
                                    <foreignObject x="0" y="499" width="1086" height="637" id="photoSelectRef">
                                    </foreignObject>
                                    <foreignObject x="47" y="1447" width="983" height="445" id="agendaRef" transform="translate(0 20)" >
                                    </foreignObject>
                                </g>)
                            }
                        </svg>
                    </div>

                    {
                        // https://stackoverflow.com/questions/41944155/align-text-to-bottom-with-shape-outside-applied
                        // very tricky to use shape-outside (to perform the triangle text wrapping)
                        // alongside vertically-aligning the wrapped text to bottom. there's not really any built-in way to do it.
                        // vertically-aligning is already badly behaving, and all methods of accomplishing it prevent the text
                        // interacting with shape-outside.
                    }
                    <div id="photoCaptionContainer">
                        <div id="photoCaptionContainerWrapShape"></div>
                        <Markdown id="photoCaption" markdown={this.gallery.getSelectedPost()?.descriptionMarkdown || ""} />
                        {/* <div id="photoCaption" dangerouslySetInnerHTML={{ __html: this.gallery.selectedPost.innerHTML }}> */}
                    </div>

                    <div id="photoSelectContainer">
                        <div id="photoBackForwardContainer">
                            <div id="photoBack" onClick={this.onClickPhotoBack}>
                            </div>
                            <div id="photoForward" onClick={this.onClickPhotoNext}>
                            </div>
                        </div>
                        {photoSelector}
                    </div>

                    <div id="agendaContent">
                        {agendaBody}
                    </div>

                    <div id="sponsorsContent">
                        <img id="nbrussel" src="/homepage/CMbrusselicon.png" />
                    </div>

                    <div id="backstageContainer"><a href={gSettings.backstageURL}><img src="/homepage/CMbackstage.png"></img></a></div>
                </div>{/* middleContent */}
            </div>//{/* root2 */ }
        );
    }
}


/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// let m1 = Date.now();

// async function WPGet(x) {
//     const url = gSettings.urlPrefix + x;
//     return new Promise((resolve, reject) => {
//         fetch(url)
//             .then(r => {
//                 r.json().then(json => {
//                     resolve(json);
//                 })
//                     .catch(reason => {
//                         console.error(`Error parsing as JSON ${url}`);
//                         console.error(reason);
//                         reject(reason);
//                     });
//             })
//             .catch(reason => {
//                 console.error(`Error fetching ${url}`);
//                 console.error(reason)
//             });
//     });
// }

// const gLoadJSON = Promise.all([
//     WPGet("posts?_embed=1&per_page=100"),
// ])
//     .then(x => {
//         window.CMconfig = {
//             posts: x[0],
//         };
//     });

// async function winmain() {
//     await gLoadJSON;

//     ReactDOM.render((<Main />), document.getElementById('root'));
// };

// if (document.readyState === 'complete') { // https://stackoverflow.com/questions/13364613/how-to-know-if-window-load-event-was-fired-already
//     winmain();
// } else {
//     window.addEventListener("load", winmain);
// }


