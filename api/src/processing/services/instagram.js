import { randomBytes } from "node:crypto";
import { resolveRedirectingURL } from "../url.js";
import { genericUserAgent } from "../../config.js";
import { createStream } from "../../stream/manage.js";
import { getCookie, updateCookie } from "../cookie/manager.js";

const commonHeaders = {
    "user-agent": genericUserAgent,
    "sec-gpc": "1",
    "sec-fetch-site": "same-origin",
    "x-ig-app-id": "936619743392459"
}

const mobileHeaders = {
    "x-ig-app-locale": "en_US",
    "x-ig-device-locale": "en_US",
    "x-ig-mapped-locale": "en_US",
    "user-agent": "Instagram 275.0.0.27.98 Android (33/13; 280dpi; 720x1423; Xiaomi; Redmi 7; onclite; qcom; en_US; 458229237)",
    "accept-language": "en-US",
    "x-fb-http-engine": "Liger",
    "x-fb-client-ip": "True",
    "x-fb-server-cluster": "True",
    "content-length": "0",
}

const embedHeaders = {
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
    "Accept-Language": "en-GB,en;q=0.9",
    "Cache-Control": "max-age=0",
    "Dnt": "1",
    "Priority": "u=0, i",
    "Sec-Ch-Ua": 'Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99',
    "Sec-Ch-Ua-Mobile": "?0",
    "Sec-Ch-Ua-Platform": "macOS",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-User": "?1",
    "Upgrade-Insecure-Requests": "1",
    "User-Agent": genericUserAgent,
}

const cachedDtsg = new WeakMap();

const getNumberFromQuery = (name, data) => {
    const s = data?.match(new RegExp(name + '=(\\d+)'))?.[1];
    if (+s) return +s;
}

const getObjectFromEntries = (name, data) => {
    const obj = data?.match(new RegExp('\\["' + name + '",.*?,({.*?}),\\d+\\]'))?.[1];
    return obj && JSON.parse(obj);
}

export default function instagram(obj) {
    const dispatcher = obj.dispatcher;

    async function findDtsgId(cookie) {
        try {
            const cached = cachedDtsg.get(cookie);
            if (cached?.expiry > Date.now()) return cached.value;

            const data = await fetch('https://www.instagram.com/', {
                headers: {
                    ...commonHeaders,
                    cookie
                },
                dispatcher
            }).then(r => r.text());

            const token = data.match(/"dtsg":{"token":"(.*?)"/)[1];

            if (token) {
                cachedDtsg.set(cookie, {
                    value: token,
                    expiry: Date.now() + 86390000
                });
                return token;
            }
            return false;
        }
        catch {}
    }

    async function request(url, cookie, method = 'GET', requestData) {
        let headers = {
            ...commonHeaders,
            'x-ig-www-claim': cookie?._wwwClaim || '0',
            'x-csrftoken': cookie?.values()?.csrftoken,
            cookie
        }
        if (method === 'POST') {
            headers['content-type'] = 'application/x-www-form-urlencoded';
        }

        const data = await fetch(url, {
            method,
            headers,
            body: requestData && new URLSearchParams(requestData),
            dispatcher
        });

        if (data.headers.get('X-Ig-Set-Www-Claim') && cookie)
            cookie._wwwClaim = data.headers.get('X-Ig-Set-Www-Claim');

        updateCookie(cookie, data.headers);
        return data.json();
    }

    async function getMediaId(id, { cookie, token } = {}) {
        const oembedURL = new URL('https://i.instagram.com/api/v1/oembed/');
        oembedURL.searchParams.set('url', `https://www.instagram.com/p/${id}/`);

        const oembed = await fetch(oembedURL, {
            headers: {
                ...mobileHeaders,
                ...( token && { authorization: `Bearer ${token}` } ),
                cookie
            },
            dispatcher
        }).then(r => r.json()).catch(() => {});

        return oembed?.media_id;
    }

    async function requestMobileApi(mediaId, { cookie, token } = {}) {
        const mediaInfo = await fetch(`https://i.instagram.com/api/v1/media/${mediaId}/info/`, {
            headers: {
                ...mobileHeaders,
                ...( token && { authorization: `Bearer ${token}` } ),
                cookie
            },
            dispatcher
        }).then(r => r.json()).catch(() => {});

        return mediaInfo?.items?.[0];
    }

    async function requestHTML(id, cookie) {
        const data = await fetch(`https://www.instagram.com/p/${id}/embed/captioned/`, {
            headers: {
                ...embedHeaders,
                cookie
            },
            dispatcher
        }).then(r => r.text()).catch(() => {});

        const serialized = data?.match(/"init",\[\],\[(.*?)\]\],/)?.[1];
        if (!serialized) return false;

        let embedData;
        try {
            embedData = JSON.parse(serialized);
        } catch {
            return false;
        }

        if (!embedData || !embedData?.contextJSON) return false;

        try {
            embedData = JSON.parse(embedData.contextJSON);
        } catch {
            return false;
        }

        return embedData;
    }

    async function getGQLParams(id, cookie) {
        const req = await fetch(`https://www.instagram.com/p/${id}/`, {
            headers: {
                ...embedHeaders,
                cookie
            },
            dispatcher
        });

        const html = await req.text();
        const siteData = getObjectFromEntries('SiteData', html);
        const polarisSiteData = getObjectFromEntries('PolarisSiteData', html);
        const webConfig = getObjectFromEntries('DGWWebConfig', html);
        const pushInfo = getObjectFromEntries('InstagramWebPushInfo', html);
        const lsd = getObjectFromEntries('LSD', html)?.token || randomBytes(8).toString('base64url');
        const csrf = getObjectFromEntries('InstagramSecurityConfig', html)?.csrf_token;

        const anon_cookie = [
            csrf && "csrftoken=" + csrf,
            polarisSiteData?.device_id && "ig_did=" + polarisSiteData?.device_id,
            "wd=1280x720",
            "dpr=2",
            polarisSiteData?.machine_id && "mid=" + polarisSiteData.machine_id,
            "ig_nrcb=1"
        ].filter(a => a).join('; ');

        return {
            headers: {
                'x-ig-app-id': webConfig?.appId || '936619743392459',
                'X-FB-LSD': lsd,
                'X-CSRFToken': csrf,
                'X-Bloks-Version-Id': getObjectFromEntries('WebBloksVersioningID', html)?.versioningID,
                'x-asbd-id': 129477,
                cookie: anon_cookie
            },
            body: {
                __d: 'www',
                __a: '1',
                __s: '::' + Math.random().toString(36).substring(2).replace(/\d/g, '').slice(0, 6),
                __hs: siteData?.haste_session || '20126.HYP:instagram_web_pkg.2.1...0',
                __req: 'b',
                __ccg: 'EXCELLENT',
                __rev: pushInfo?.rollout_hash || '1019933358',
                __hsi: siteData?.hsi || '7436540909012459023',
                __dyn: randomBytes(154).toString('base64url'),
                __csr: randomBytes(154).toString('base64url'),
                __user: '0',
                __comet_req: getNumberFromQuery('__comet_req', html) || '7',
                av: '0',
                dpr: '2',
                lsd,
                jazoest: getNumberFromQuery('jazoest', html) || Math.floor(Math.random() * 10000),
                __spin_r: siteData?.__spin_r || '1019933358',
                __spin_b: siteData?.__spin_b || 'trunk',
                __spin_t: siteData?.__spin_t || Math.floor(new Date().getTime() / 1000),
            }
        };
    }

    async function requestGQL(id, cookie) {
        const { headers, body } = await getGQLParams(id, cookie);

        const req = await fetch('https://www.instagram.com/graphql/query', {
            method: 'POST',
            dispatcher,
            headers: {
                ...embedHeaders,
                ...headers,
                ...(cookie && { cookie }),
                'content-type': 'application/x-www-form-urlencoded',
                'X-FB-Friendly-Name': 'PolarisPostActionLoadPostQueryQuery',
            },
            body: new URLSearchParams({
                ...body,
                fb_api_caller_class: 'RelayModern',
                fb_api_req_friendly_name: 'PolarisPostActionLoadPostQueryQuery',
                variables: JSON.stringify({
                    shortcode: id,
                    fetch_tagged_user_count: null,
                    hoisted_comment_id: null,
                    hoisted_reply_id: null
                }),
                server_timestamps: true,
                doc_id: '8845758582119845'
            }).toString()
        });

        return {
            gql_data: await req.json()
                        .then(r => r.data)
                        .catch(() => null)
        };
    }

    async function getErrorContext(id) {
        try {
            const { headers, body } = await getGQLParams(id);

            const req = await fetch('https://www.instagram.com/ajax/bulk-route-definitions/', {
                method: 'POST',
                dispatcher,
                headers: {
                    ...embedHeaders,
                    ...headers,
                    'content-type': 'application/x-www-form-urlencoded',
                    'X-Ig-D': 'www',
                },
                body: new URLSearchParams({
                    'route_urls[0]': `/p/${id}/`,
                    routing_namespace: 'igx_www',
                    ...body
                }).toString()
            });

            const response = await req.text();
            if (response.includes('"tracePolicy":"polaris.privatePostPage"'))
                return { error: 'content.post.private' };

            const [, mediaId, mediaOwnerId] = response.match(
                /"media_id":\s*?"(\d+)","media_owner_id":\s*?"(\d+)"/
            ) || [];

            if (mediaId && mediaOwnerId) {
                const rulingURL = new URL('https://www.instagram.com/api/v1/web/get_ruling_for_media_content_logged_out');
                rulingURL.searchParams.set('media_id', mediaId);
                rulingURL.searchParams.set('owner_id', mediaOwnerId);

                const rulingResponse = await fetch(rulingURL, {
                    headers: {
                        ...headers,
                        ...commonHeaders
                    },
                    dispatcher,
                }).then(a => a.json()).catch(() => ({}));

                if (rulingResponse?.title?.includes('Restricted'))
                    return { error: "content.post.age" };
            }
        } catch {
            return { error: "fetch.fail" };
        }

        return { error: "fetch.empty" };
    }

    const firstImageURL = data => {
        const candidates = data?.image_versions2?.candidates;
        if (!Array.isArray(candidates)) return;

        return candidates.find(candidate => (
            typeof candidate?.url === "string" && candidate.url.length
        ))?.url;
    };

    const largestVideo = versions => {
        if (!Array.isArray(versions)) return;

        return versions
            .filter(video => typeof video?.url === "string" && video.url.length)
            .reduce((largest, video) => {
                if (!largest) return video;
                const largestArea = Number(largest.width) * Number(largest.height) || 0;
                const videoArea = Number(video.width) * Number(video.height) || 0;
                return largestArea < videoArea ? video : largest;
            }, undefined);
    }

    const hasMedia = media => {
        if (!media || typeof media !== "object") return false;

        const sidecarEdges = media?.edge_sidecar_to_children?.edges;
        if (Array.isArray(sidecarEdges)) {
            return sidecarEdges.length > 0 && sidecarEdges.every(({ node } = {}) => (
                typeof node?.display_url === "string" && node.display_url.length
            ));
        }

        const hasOldVideo = typeof media.video_url === "string" && media.video_url.length;
        const hasOldImage = typeof media.display_url === "string" && media.display_url.length;
        if (hasOldVideo || hasOldImage) {
            return true;
        }

        if (Array.isArray(media.carousel_media)) {
            return media.carousel_media.length > 0 && media.carousel_media.every(item => {
                if (!firstImageURL(item)) return false;
                return item?.video_versions ? !!largestVideo(item.video_versions) : true;
            });
        }

        if (media.video_versions) return !!largestVideo(media.video_versions);
        return !!firstImageURL(media);
    }

    const hasData = data => {
        if (!data || typeof data !== "object") return false;
        if (Object.hasOwn(data, "gql_data")) {
            return hasMedia(
                data?.gql_data?.shortcode_media
                || data?.gql_data?.xdt_shortcode_media
            );
        }
        return hasMedia(data);
    }

    function extractOldPost(data, id, alwaysProxy) {
        const shortcodeMedia = data?.gql_data?.shortcode_media || data?.gql_data?.xdt_shortcode_media;
        const sidecar = shortcodeMedia?.edge_sidecar_to_children;

        if (Array.isArray(sidecar?.edges)) {
            const picker = sidecar.edges
                .map((e, i) => {
                    const videoURL = typeof e.node?.video_url === "string"
                        ? e.node.video_url
                        : undefined;
                    const type = e.node?.is_video && videoURL ? "video" : "photo";
                    const url = type === "video"
                        ? videoURL
                        : e.node?.display_url;
                    const thumbURL = e.node?.display_url;
                    if (!url || !thumbURL) return;

                    let itemExt = type === "video" ? "mp4" : "jpg";

                    let proxyFile;
                    if (alwaysProxy) proxyFile = createStream({
                        service: "instagram",
                        type: "proxy",
                        url,
                        filename: `instagram_${id}_${i + 1}.${itemExt}`
                    });

                    return {
                        type,
                        url: proxyFile || url,
                        /* thumbnails have `Cross-Origin-Resource-Policy`
                        ** set to `same-origin`, so we need to proxy them */
                        thumb: createStream({
                            service: "instagram",
                            type: "proxy",
                            url: thumbURL,
                            filename: `instagram_${id}_${i + 1}.jpg`
                        })
                    }
                })
                .filter(Boolean);

            if (picker.length === sidecar.edges.length && picker.length) return { picker }
            return;
        }

        if (shortcodeMedia?.video_url) {
            return {
                urls: shortcodeMedia.video_url,
                filename: `instagram_${id}.mp4`,
                audioFilename: `instagram_${id}_audio`
            }
        }

        if (shortcodeMedia?.display_url) {
            return {
                urls: shortcodeMedia.display_url,
                isPhoto: true,
                filename: `instagram_${id}.jpg`,
            }
        }
    }

    function extractNewPost(data, id, alwaysProxy) {
        const carousel = data.carousel_media;
        if (Array.isArray(carousel)) {
            const picker = carousel
                .map((e, i) => {
                    const video = largestVideo(e?.video_versions);
                    if (e?.video_versions && !video) return;
                    const type = video ? "video" : "photo";
                    const imageUrl = firstImageURL(e);
                    if (!imageUrl) return;

                    let url = imageUrl;
                    let itemExt = type === "video" ? "mp4" : "jpg";

                    if (type === "video") {
                        url = video.url;
                    }

                    let proxyFile;
                    if (alwaysProxy) proxyFile = createStream({
                        service: "instagram",
                        type: "proxy",
                        url,
                        filename: `instagram_${id}_${i + 1}.${itemExt}`
                    });

                    return {
                        type,
                        url: proxyFile || url,
                        /* thumbnails have `Cross-Origin-Resource-Policy`
                        ** set to `same-origin`, so we need to always proxy them */
                        thumb: createStream({
                            service: "instagram",
                            type: "proxy",
                            url: imageUrl,
                            filename: `instagram_${id}_${i + 1}.jpg`
                        })
                    }
                })
                .filter(Boolean);

            if (picker.length === carousel.length && picker.length) return { picker }
        } else if (data.video_versions) {
            const video = largestVideo(data.video_versions);
            if (!video) return;
            return {
                urls: video.url,
                filename: `instagram_${id}.mp4`,
                audioFilename: `instagram_${id}_audio`
            }
        } else if (firstImageURL(data)) {
            return {
                urls: firstImageURL(data),
                isPhoto: true,
                filename: `instagram_${id}.jpg`,
            }
        }
    }

    async function getPost(id, alwaysProxy) {
        let data, result;
        try {
            const cookie = getCookie('instagram');

            const bearer = getCookie('instagram_bearer');
            const token = bearer?.values()?.token;

            // get media_id for mobile api, three methods
            let media_id = await getMediaId(id);
            if (!media_id && token) media_id = await getMediaId(id, { token });
            if (!media_id && cookie) media_id = await getMediaId(id, { cookie });

            // mobile api (bearer)
            if (media_id && token) data = await requestMobileApi(media_id, { token });

            // mobile api (no cookie, cookie)
            if (media_id && !hasData(data)) data = await requestMobileApi(media_id);
            if (media_id && cookie && !hasData(data)) data = await requestMobileApi(media_id, { cookie });

            // html embed (no cookie, cookie)
            if (!hasData(data)) data = await requestHTML(id);
            if (!hasData(data) && cookie) data = await requestHTML(id, cookie);

            // web app graphql api (no cookie, cookie)
            if (!hasData(data)) data = await requestGQL(id);
            if (!hasData(data) && cookie) data = await requestGQL(id, cookie);
        } catch {}

        if (!hasData(data)) {
            return getErrorContext(id);
        }

        if (data?.gql_data) {
            result = extractOldPost(data, id, alwaysProxy)
        } else {
            result = extractNewPost(data, id, alwaysProxy)
        }

        if (result) return result;
        return { error: "fetch.empty" }
    }

    async function usernameToId(username, cookie) {
        const url = new URL('https://www.instagram.com/api/v1/users/web_profile_info/');
            url.searchParams.set('username', username);

        try {
            const data = await request(url, cookie);
            return data?.data?.user?.id;
        } catch {}
    }

    async function getStory(username, id) {
        const cookie = getCookie('instagram');
        if (!cookie) return { error: "link.unsupported" };

        const userId = await usernameToId(username, cookie);
        if (!userId) return { error: "fetch.empty" };

        const dtsgId = await findDtsgId(cookie);

        const url = new URL('https://www.instagram.com/api/graphql/');
        const requestData = {
            fb_dtsg: dtsgId,
            jazoest: '26438',
            variables: JSON.stringify({
                reel_ids_arr : [ userId ],
            }),
            server_timestamps: true,
            doc_id: '25317500907894419'
        };

        let media;
        try {
            const data = (await request(url, cookie, 'POST', requestData));
            media = data?.data?.xdt_api__v1__feed__reels_media?.reels_media?.find(m => m.id === userId);
        } catch {}

        const item = Array.isArray(media?.items)
            ? media.items.find(m => m.pk === id)
            : undefined;
        if (!item) return { error: "fetch.empty" };

        const video = largestVideo(item.video_versions);
        if (video) {
            return {
                urls: video.url,
                filename: `instagram_${id}.mp4`,
                audioFilename: `instagram_${id}_audio`
            }
        }

        const imageURL = firstImageURL(item);
        if (imageURL) {
            return {
                urls: imageURL,
                isPhoto: true,
                filename: `instagram_${id}.jpg`,
            }
        }

        return { error: "link.unsupported" };
    }

    const { postId, shareId, storyId, username, alwaysProxy } = obj;

    if (shareId) {
        return resolveRedirectingURL(
            `https://www.instagram.com/share/${shareId}/`,
            dispatcher,
            // for some reason instagram decides to return HTML
            // instead of a redirect when requesting with a normal
            // browser user-agent
            {'User-Agent': 'curl/7.88.1'}
        ).then(match => instagram({
            ...obj, ...match,
            shareId: undefined
        }));
    }

    if (postId) return getPost(postId, alwaysProxy);
    if (username && storyId) return getStory(username, storyId);

    return { error: "fetch.empty" }
}
