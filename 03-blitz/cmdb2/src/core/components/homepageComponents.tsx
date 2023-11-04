import React, { Suspense } from "react";
import { IsNullOrWhitespace, modulo } from "shared/utils";
import { Markdown } from "./RichTextEditor";
import { API, HomepageAgendaItemSpec, HomepageContentSpec } from "../db3/clientAPI";
import { gIconMap } from "../db3/components/IconSelectDialog";
import * as db3 from "../db3/db3";
import { nanoid } from 'nanoid';


const gSettings = {
    backstageURL: `/backstage`,
    photoCarrouselAutoPlayIntervalMS: 10000,
    portraitNaturalWidth: 830, // vert
    landscapeNaturalWidth: 1500, // horiz
};

export interface MainSVGRefs {
    photoCaptionRef: SVGForeignObjectElement | null;
    photoSelectRef: SVGForeignObjectElement | null;
    agendaRef: SVGForeignObjectElement | null;
    galleryPhoto1Ref: SVGPolygonElement | null;
    galleryPhoto2Ref: SVGPolygonElement | null;
};

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

function UninstallOrientationChangeListener(proc) {
    if (screen && screen.orientation) {
        screen.orientation.removeEventListener('change', proc);
        return;
    }

    var mql = window.matchMedia("(orientation: portrait)");

    // https://www.tabnine.com/code/javascript/functions/builtins/MediaQueryList/addEventListener
    if (mql.removeEventListener) {
        mql.removeEventListener('change', proc);
    } else if (mql.removeListener) {
        mql.removeListener(proc);
    }
}

// encapsulates gallery logic
class Gallery {

    private selectedIdx: number; // may be out of bounds; modulo when accessing.
    ab: boolean;
    content: HomepageContentSpec | null;
    //photoIDMap: Record<number, string>;
    instanceKey: string;
    mainSVGRefs: MainSVGRefs;

    photoSelectorRef: HTMLUListElement | null;

    constructor() {
        this.content = null;
        this.instanceKey = "";
        this.selectedIdx = (Math.random() * 1000) | 0;

        this.ab = false; // to swap A and B for transitioning
    }

    setContent(content: HomepageContentSpec | null) {
        this.content = content;
    };

    setPhotoIDMap(instanceKey: string, refs: MainSVGRefs, photoSelectorRef: HTMLUListElement | null) {
        this.instanceKey = instanceKey;
        this.photoSelectorRef = photoSelectorRef;
        this.mainSVGRefs = refs;
    };

    applyStateToDOM() {
        //return;
        if (this.instanceKey === "" || !this.content || (this.content.gallery.length < 1)) {
            //no no no const a = document.getElementById("galleryPhoto2");
            if (this.mainSVGRefs.galleryPhoto2Ref) this.mainSVGRefs.galleryPhoto2Ref.setAttribute("fill", `#0008`);
            return;
        }

        const posts = this.content.gallery;
        const indexInRange = this.bringIndexIntoRange(this.selectedIdx);
        const post = this.content.gallery[indexInRange]!;
        const nextPostID = this.bringIndexIntoRange(this.selectedIdx + 1);
        const nextPost = posts[nextPostID]!;

        const thisPostImage = document.getElementById(`galleryPatternImage_${this.instanceKey}_${post.id}`);
        if (thisPostImage) {
            thisPostImage.setAttribute('href', API.files.getURIForFile(post.file))
        }
        const nextPostImage = document.getElementById(`galleryPatternImage_${this.instanceKey}_${nextPost.id}`);
        if (nextPostImage) {
            nextPostImage.setAttribute('href', API.files.getURIForFile(nextPost.file));
        }

        const a = this.ab ? this.mainSVGRefs.galleryPhoto2Ref : this.mainSVGRefs.galleryPhoto1Ref;
        const b = this.ab ? this.mainSVGRefs.galleryPhoto1Ref : this.mainSVGRefs.galleryPhoto2Ref;
        if (!a || !b) return; // error actually.

        a.setAttribute("fill", `url(#galleryPattern_${this.instanceKey}_${post.id})`);

        if (this.photoSelectorRef) {
            this.photoSelectorRef.style.setProperty("--count", `${posts.length}`);
        }

        a.style.opacity = "100%";
        b.style.opacity = "0%";
    }

    getSelectedPost(): db3.FrontpageGalleryItemPayload | null {
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
export interface AgendaItemProps {
    item: HomepageAgendaItemSpec;
};

export class AgendaItem extends React.Component<AgendaItemProps> {

    constructor(props: AgendaItemProps) {
        super(props);
        this.state = {};
    }

    render() {
        const post = this.props.item;
        return (<div className="agendaPost">
            {!IsNullOrWhitespace(post.date) && <div className="agendaDate">{post.date}</div>}
            {!IsNullOrWhitespace(post.title) && <div className="agendaTitle">{post.title}</div>}
            {!IsNullOrWhitespace(post.location) && !IsNullOrWhitespace(post.locationURI) && <a target="_blank" href={post.locationURI || ""}><div className="agendaLocation">{gIconMap.Place()}{post.location}</div></a>}
            {!IsNullOrWhitespace(post.location) && IsNullOrWhitespace(post.locationURI) && <div className="agendaLocation">{gIconMap.Place()}{post.location}</div>}
            {!IsNullOrWhitespace(post.time) && <div className="agendaTime">{gIconMap.Schedule()}{post.time}</div>}
            {!IsNullOrWhitespace(post.tags) && <div className="agendaTags">{post.tags}</div>}
            {!IsNullOrWhitespace(post.detailsMarkdown) && <Markdown markdown={post.detailsMarkdown || ""} className="agendaDetails" />}

        </div>
        );
    }
}

const TopRight2 = () => {
    return <div className="toprighttitle">
        <div className="subtitle1"><span className="nowrap">NO-NONSENSE&nbsp;ALL&nbsp;STYLE ORCHESTRA FROM&nbsp;BRUXL</span></div>
        <div className="subtitle2">
            <span className="nowrap">BOOK&nbsp;US! PLAY&nbsp;WITH&nbsp;US! COME&nbsp;SEE&nbsp;US!</span>

            <div className='socicons'>
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

export interface MainSVGComponentProps {
    content: HomepageContentSpec;
    //galleryPhotoIDMap: Record<number, string>; // a mapping of photo ID to unique ID which can be used in the DOM.
    instanceKey: string; // unique-to-page instance key for generating IDs.
    onRefsChanged: (refs: MainSVGRefs) => void;
};
export const MainSVGComponent = (props: MainSVGComponentProps) => {

    const photoCaptionRef = React.useRef<SVGForeignObjectElement>(null);
    const photoSelectRef = React.useRef<SVGForeignObjectElement>(null);
    const agendaRef = React.useRef<SVGForeignObjectElement>(null);
    const galleryPhoto1Ref = React.useRef<SVGPolygonElement>(null);
    const galleryPhoto2Ref = React.useRef<SVGPolygonElement>(null);

    React.useEffect(() => {
        props.onRefsChanged({
            photoCaptionRef: photoCaptionRef.current,
            photoSelectRef: photoSelectRef.current,
            agendaRef: agendaRef.current,
            galleryPhoto1Ref: galleryPhoto1Ref.current,
            galleryPhoto2Ref: galleryPhoto2Ref.current,
        });
    }, [
        photoCaptionRef.current,
        photoSelectRef.current,
        agendaRef.current,
        galleryPhoto1Ref.current,
        galleryPhoto2Ref.current,
    ]);

    const bothSvgParams = {
        landscape: {
            svgViewBox: "0 0 2130 1496",
        },
        portrait: {
            svgViewBox: "0 0 1086 2200",
        }
    }

    const svgParams = (window.innerHeight < window.innerWidth) ? bothSvgParams.landscape : bothSvgParams.portrait;

    return <div className="galleryContainer">
        <svg viewBox={svgParams.svgViewBox} preserveAspectRatio="xMinYMin meet">
            <defs>
                {
                    props.content.gallery.map((post, idx) => {
                        let wpimagesource = API.files.getURIForFile(post.file);

                        // preserving aspect ratio of these:
                        // https://stackoverflow.com/questions/22883994/crop-to-fit-an-svg-pattern
                        return (
                            <pattern key={idx} id={`galleryPattern_${props.instanceKey}_${post.id}`} height="100%" width="100%" patternContentUnits="objectBoundingBox" viewBox="0 0 1 1" preserveAspectRatio="xMidYMid slice">
                                <image height="1" width="1" href={wpimagesource} id={`galleryPatternImage_${props.instanceKey}_${post.id}`} preserveAspectRatio="xMidYMid slice" />
                            </pattern>
                        );
                    })
                }
            </defs>

            {(window.innerHeight < window.innerWidth) ? // landscape (horiz)
                (<g>
                    <polygon points="894,385 2106,296 2020,1398 1074,1496" className="agendaBack" /> {/* green odd background polygon */}
                    <polygon points="1089,383 2072,383 2072,1438 1089,1438" className="agendaBack2" /> {/* yellow rect background */}
                    <polygon points="0,1136 541,1447 0,1398" className="galleryOrange" />{/* orange triangle for photo caption */}
                    <polygon points="541,187 628,176 1086,502" className="galleryPink" />
                    <polygon points="628,176 663,173 1086,502" className="galleryBlue" />
                    <polygon points="0,499 541,187 1086,502 1086,1132 541,1447 0,1136" fill="none" className="galleryPhoto1" ref={galleryPhoto1Ref} />
                    <polygon points="0,499 541,187 1086,502 1086,1132 541,1447 0,1136" fill="none" className="galleryPhoto2" ref={galleryPhoto2Ref} />
                    <image width="330" height="330" href="/homepage/CMlogo.png" preserveAspectRatio="xMinYMin slice"></image>
                    <foreignObject x="0" y="1136" width="541" height="262" className="photoCaptionRef" ref={photoCaptionRef}>
                    </foreignObject>
                    <foreignObject x="0" y="499" width="1086" height="637" className="photoSelectRef" ref={photoSelectRef}>
                    </foreignObject>
                    <foreignObject x="1089" y="383" width="983" height="1055" className="agendaRef" ref={agendaRef}>
                    </foreignObject>
                </g>) : // portrait (vert)
                (<g>
                    <polygon points="0,385 1064,296 978,1398 32,1496" className="agendaBack" transform="translate(0 474)" />
                    <polygon points="47,837 1030,837 1030,1892 47,1892" className="agendaBack2" transform="translate(0 20)" />
                    <polygon points="0,1136 541,1447 0,1398" className="galleryOrange" />
                    <polygon points="541,187 628,176 1086,502" className="galleryPink" />
                    <polygon points="628,176 663,173 1086,502" className="galleryBlue" />
                    <polygon points="0,499 541,187 1086,502 1086,1132 541,1447 0,1136" fill="url(#galleryPhotoSrc1)" className="galleryPhoto1" ref={galleryPhoto1Ref} />
                    <polygon points="0,499 541,187 1086,502 1086,1132 541,1447 0,1136" fill="url(#galleryPhotoSrc2)" className="galleryPhoto2" ref={galleryPhoto2Ref} />
                    <image width="330" height="330" href="/homepage/CMlogo.png" preserveAspectRatio="xMinYMin slice"></image>
                    <foreignObject x="0" y="1136" width="541" height="262" className="photoCaptionRef" ref={photoCaptionRef}>
                    </foreignObject>
                    <foreignObject x="0" y="499" width="1086" height="637" className="photoSelectRef" ref={photoSelectRef}>
                    </foreignObject>
                    <foreignObject x="47" y="1447" width="983" height="445" className="agendaRef" transform="translate(0 20)" ref={agendaRef}>
                    </foreignObject>
                </g>)
            }
        </svg>
    </div>

};

// given a <foreignObject> reference
// and a target DOM element,
// and a common relative-position parent,
// set the DOM element to the position of the foreignObject. Can't just embed directly in the foreignObject because
// the scaling & filters will make things very unpredictable, and that behavior is getting very fringe and not unified across modern browsers.
const correctLayoutFromRef = (refel: SVGForeignObjectElement | undefined | null, targetEl: HTMLDivElement | undefined | null, commonParent: HTMLDivElement | undefined | null) => {
    if (!refel) return;
    if (!targetEl) return;
    if (!commonParent) return;
    const rc = refel.getBoundingClientRect();
    const rcp = commonParent.getBoundingClientRect();
    targetEl.style.left = (rc.left - rcp.left) + "px";
    targetEl.style.top = (rc.top - rcp.top) + "px";
    targetEl.style.height = (rc.height) + "px";
    targetEl.style.width = (rc.width) + "px";
}


/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export interface HomepageMainProps {
    content: HomepageContentSpec;
    className?: string;
    fullPage: boolean; //
    //root2Ref: HTMLDivElement | null;
};

//export class HomepageMain extends React.Component<HomepageMainProps> {
export const HomepageMain = ({ content, className, fullPage }: HomepageMainProps) => {
    const [gallery, setGallery] = React.useState<Gallery>(() => new Gallery());
    gallery.setContent(content);

    const [galleryTimer, setGalleryTimer] = React.useState<NodeJS.Timeout | null>(null);

    const [instanceKey, setInstanceKey] = React.useState<string>(() => nanoid());

    //const [mounted, setMounted] = React.useState<boolean>(false);
    const [refreshSerial, setRefreshSerial] = React.useState<number>(0);// to induce re-render, increment

    const svgRefs = React.useRef<MainSVGRefs>({
        photoCaptionRef: null,
        photoSelectRef: null,
        agendaRef: null,
        galleryPhoto1Ref: null,
        galleryPhoto2Ref: null,
    });

    const root2Ref = React.useRef<HTMLDivElement | null>(null);
    const middleContentRef = React.useRef<HTMLDivElement | null>(null);
    const photoCaptionContainerRef = React.useRef<HTMLDivElement | null>(null);
    const photoSelectContainerRef = React.useRef<HTMLDivElement | null>(null);
    const photoSelectorRef = React.useRef<HTMLUListElement | null>(null);
    const agendaContentRef = React.useRef<HTMLDivElement | null>(null);

    const isMounted = !!root2Ref && !!middleContentRef;

    const syncGalleryParams = () => {
        gallery.setPhotoIDMap(instanceKey, svgRefs.current, photoSelectorRef.current);
    };

    React.useEffect(() => {
        syncGalleryParams();
    }, [svgRefs, instanceKey, content, photoSelectorRef.current]);

    const updateLayout = () => {
        setTimeout(() => { // necessary to let the browser shuffle the layout.
            const root2 = root2Ref.current;
            const psvgRefs = svgRefs.current;
            correctLayoutFromRef(psvgRefs.photoCaptionRef, photoCaptionContainerRef.current, middleContentRef.current);
            correctLayoutFromRef(psvgRefs.photoSelectRef, photoSelectContainerRef.current, middleContentRef.current);
            correctLayoutFromRef(psvgRefs.agendaRef, agendaContentRef.current, middleContentRef.current);

            setRefreshSerial(refreshSerial + 1);
            gallery.applyStateToDOM();

            if (root2) {
                //const root2 = document.querySelector(".root2") as HTMLElement;
                const horizOrientation = (window.innerHeight < window.innerWidth);
                // because the overall page layout depends on orientation, the natural width changes depending on orient. so use different default widths.
                const zoomFact = horizOrientation ? (root2.clientWidth / gSettings.landscapeNaturalWidth) : (root2.clientWidth / gSettings.portraitNaturalWidth);
                root2.style.setProperty("--page-zoom", `${(zoomFact * 100).toFixed(2)}%`);
                root2.style.opacity = "100%";
            }
        }, 50);
    }

    const onSelectPhoto = (i) => {
        gallery.setSelectedIdx(i);

        clearTimeout(galleryTimer || undefined);
        setGalleryTimer(setTimeout(galleryTimerProc, gSettings.photoCarrouselAutoPlayIntervalMS));
        setRefreshSerial(refreshSerial + 1);
    }

    const onClickPhotoNext = () => {
        gallery.setSelectedIdx(gallery.getSelectedIndex() + 1);
        setRefreshSerial(refreshSerial + 1);
    }

    const onClickPhotoBack = () => {
        gallery.setSelectedIdx(gallery.getSelectedIndex() - 1);
        setRefreshSerial(refreshSerial + 1);
    }

    const galleryTimerProc = () => {
        if (!isMounted) return;
        onClickPhotoNext();
        setGalleryTimer(setTimeout(galleryTimerProc, gSettings.photoCarrouselAutoPlayIntervalMS));
    }

    // https://stackoverflow.com/questions/58831750/how-to-add-event-in-react-functional-component
    React.useEffect(() => {
        if (fullPage) {
            window.addEventListener("resize", updateLayout);
            InstallOrientationChangeListener(updateLayout);
        }
        updateLayout();

        return () => {
            if (fullPage) {
                window.removeEventListener("resize", updateLayout);
                UninstallOrientationChangeListener(updateLayout);
            }
        };
    }, []);

    React.useEffect(() => {
        updateLayout();
        setGalleryTimer(setTimeout(galleryTimerProc, gSettings.photoCarrouselAutoPlayIntervalMS));

        return () => {
            clearTimeout(galleryTimer || undefined);
        };
    }, [root2Ref]);

    return (<div className={`root2 ${className} ${fullPage ? "fullPage" : "embedded"}`} ref={root2Ref}>
        <div className="headerChrome">
            <TopRight2 />
        </div>
        <div className="middleContent" ref={middleContentRef}>
            <MainSVGComponent content={content} onRefsChanged={(val) => {
                svgRefs.current = val;
                updateLayout();
                syncGalleryParams();
            }} instanceKey={instanceKey} />

            {
                // https://stackoverflow.com/questions/41944155/align-text-to-bottom-with-shape-outside-applied
                // very tricky to use shape-outside (to perform the triangle text wrapping)
                // alongside vertically-aligning the wrapped text to bottom. there's not really any built-in way to do it.
                // vertically-aligning is already badly behaving, and all methods of accomplishing it prevent the text
                // interacting with shape-outside.
            }
            <div className="photoCaptionContainer" ref={photoCaptionContainerRef}>
                <div className="photoCaptionContainerWrapShape"></div>
                <Markdown className="photoCaption" markdown={gallery.getSelectedPost()?.caption || ""} />
            </div>

            <div className="photoSelectContainer" ref={photoSelectContainerRef}>
                <div className="photoBackForwardContainer">
                    <div className="photoBack" onClick={onClickPhotoBack}>
                    </div>
                    <div className="photoForward" onClick={onClickPhotoNext}>
                    </div>
                </div>
                <ul className="photoSelector" ref={photoSelectorRef}>
                    {content.gallery.map((post, i) => (
                        <li key={i} onClick={() => onSelectPhoto(i)}>
                            <svg viewBox="-25 -25 350 350" preserveAspectRatio="xMidYMid meet" className={"photoSelectHex" + (i === gallery.getSelectedIndex() ? " selected" : "")} >
                                <polygon className="photoSelectHexShape1" points="150,300 280,225 280,75 150,0 20,75 20,225"></polygon>
                                <polygon className="photoSelectHexShape2" points="150,300 280,225 280,75 150,0 20,75 20,225"></polygon>
                            </svg>
                        </li>
                    ))}
                </ul>
            </div>

            <div className="agendaContent frontpageAgendaContentWrapper" ref={agendaContentRef}>
                <div className="agendaContentContainer">
                    {content.agenda.map((p, i) => {
                        return <AgendaItem key={i} item={p} />;
                    })}
                </div>
            </div>

            {!!fullPage && <>
                <div className="sponsorsContent">
                    <img className="nbrussel" src="/homepage/CMbrusselicon.png" />
                </div>

                <div className="backstageContainer"><a href={gSettings.backstageURL}><img src="/homepage/CMbackstage.png"></img></a></div>
            </>
            }
        </div>
    </div>
    );
};



// /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// export interface HomepageMainProps {
//     content: HomepageContentSpec;
// };

// export const HomepageMain = ({ content }: HomepageMainProps) => {
//     //const root2Ref = React.useRef<HTMLDivElement | null>(null);
//     //const [refreshSerial, setRefreshSerial] = React.useState<number>(0);// to induce re-render, increment

//     // const updateLayout = () => {
//     //     setTimeout(() => { // necessary to let the browser shuffle the layout.
//     //         if (root2Ref.current) {
//     //             //const root2 = document.querySelector(".root2") as HTMLElement;
//     //             const horizOrientation = (window.innerHeight < window.innerWidth);
//     //             // because the overall page layout depends on orientation, the natural width changes depending on orient. so use different default widths.
//     //             const zoomFact = horizOrientation ? (root2Ref.current.clientWidth / gSettings.landscapeNaturalWidth) : (root2Ref.current.clientWidth / gSettings.portraitNaturalWidth);
//     //             root2Ref.current.style.setProperty("--page-zoom", `${(zoomFact * 100).toFixed(2)}%`);
//     //             root2Ref.current.style.opacity = "100%";
//     //         }
//     //     }, 50);
//     // }

//     // https://stackoverflow.com/questions/58831750/how-to-add-event-in-react-functional-component
//     // even though this is working fine (so far) i am concerned about the removal of event listeners for local const functions. if tehy have a capture,
//     // then how does this possibly work?
//     // React.useEffect(() => {
//     //     window.addEventListener("resize", updateLayout);
//     //     InstallOrientationChangeListener(updateLayout);
//     //     setTimeout(updateLayout, 1);

//     //     return () => {
//     //         window.removeEventListener("resize", updateLayout);
//     //         UninstallOrientationChangeListener(updateLayout);
//     //     };
//     // }, []);

//     return (
//         <div className="root2" ref={(ref) => {
//             root2Ref.current = ref;
//             //setRefreshSerial(refreshSerial + 1);
//         }}>
//             <div className="headerChrome">
//                 <TopRight2 />
//             </div>
//             <HomepageMiddleContent content={content} root2Ref={root2Ref.current} />
//         </div>
//     );
// };

