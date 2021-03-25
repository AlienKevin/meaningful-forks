// ==UserScript==
//@name          meaningful-forks
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  Sort Github fork lists by the number of stars and commits ahead from the source repo.
// @author       Kevin Li
// @match        https://github.com/*/network/members
// @grant        none
// ==/UserScript==

(async function () {
    // NOTE: Do NOT release key with source
    const accessToken = "f9765ac063fb541c632e7baec5bc91f0db0738dc"
    
    // Show loading gif while sorting forks
    const loading = document.createElement("span");
    loading.innerText = "Sorting 🍴forks...";
    loading.style.position = "fixed";
    loading.style.background = "#22f922";
    loading.style.padding = "10px";
    loading.style.borderRadius = "10px";
    loading.style.zIndex = "9999";
    // must put whitespace around "-", see here: https://stackoverflow.com/questions/34419813/why-must-a-or-be-surrounded-with-whitespace-from-within-the-calc-method
    loading.style.left = "calc(50% - 60px)";
    loading.style.top = "calc(50% - 20px)";
    document.body.appendChild(loading);

    function processUrl(url) {
        if (url.indexOf("?") < 0) {
            return `${url}?access_token=${accessToken}`;
        } else {
            return `${url}&access_token=${accessToken}`;
        }
    }
    const network = document.querySelector("#network");

    // like: musically-ut/lovely-forks
    const sourceRepoName = network.firstElementChild.lastElementChild.getAttribute("href").substring(1);
    console.log("TCL: currentRepoUrl", sourceRepoName);
    const sourceAuthorName = sourceRepoName.substring(0, sourceRepoName.lastIndexOf("/"));
    // like: https://api.github.com/repos/GhettoSanta/lovely-forks/forks?sort=stargazers
    const forkApiUrl = processUrl(`https://api.github.com/repos/${sourceRepoName}/forks?sort=stargazers`);
    console.log("TCL: forkApiUrl", forkApiUrl)
    let data = await fetch(forkApiUrl);
    const forks = await data.json();
    // console.log("TCL: forks", forks.filter(fork => fork.owner.type === "Organization"));
    forks.forEach(fork => {
        console.log(fork.full_name + ", ");
    })
    console.log("TCL: forks.length: " + forks.length);
    const stargazerCheckPromises = [];
    forks.forEach((fork, index, forks) => {
        // like: mcanthony
        const authorName = fork["owner"]["login"];
        console.log("TCL: authorName", authorName)
        const stargazersUrl = processUrl(fork["stargazers_url"]);
        stargazerCheckPromises.push(
            fetch(stargazersUrl).then(data => {
                if (data.ok) {
                    return data.json();
                }
                throw new Error("Network response is not OK!");
            }).then(stargazers => {
                // console.log("TCL: stargazers", stargazers)
                stargazers.forEach((stargazer) => {
                    if (stargazer["login"] === authorName && forks[index]["stargazers_count"] > 0) {
                        console.log(`TCL: starCount of ${authorName} before: ${forks[index]["stargazers_count"]}`);
                        // do not count the author's star
                        forks[index]["stargazers_count"]--;
                        console.log(`TCL: starCount of ${authorName} after: ${forks[index]["stargazers_count"]}`);
                    }
                });
            }).catch(function (error) {
                console.log('There has been a problem with your fetch operation: ', error.message);
            })
        );
    });

    await Promise.all(stargazerCheckPromises);
    forks.sort(sortBy('stargazers_count', true, parseInt));
    console.log("End of modifying stargazer count!");

    await asyncForEach(forks, async (fork, index, forks) => {
        try {
            const forkAuthorName = fork["owner"]["login"];
            const forkName = fork["full_name"]; // like: mcanthony/lovely-forks
            // Get defautl branch of parent repo (where the current fork is forked from)
            // like: https://api.github.com/repos/GhettoSanta/lovely-forks
            let sourceDefaultBranch = await getDefaultBranch(sourceRepoName);

            // Get default branch for current fork
            let forkDefaultBranch = await getDefaultBranch(forkName);

            const branchCompareUrl = processUrl(`https://api.github.com/repos/${forkName}/compare/${sourceAuthorName}:${sourceDefaultBranch}...${forkAuthorName}:${forkDefaultBranch}`);

            let [aheadBy, behindBy] = await getFromApi(branchCompareUrl, ["ahead_by", "behind_by"]);
            forks[index]["ahead_by"] = aheadBy;
            forks[index]["behind_by"] = behindBy;
        } catch (error) {
            console.log(error);
        }
    });

    console.log("TCL: forks", forks);

    forks.sort(sortByMultipleFields({
        name: "stargazers_count",
        primer: parseInt,
        highToLow: true
    }, {
        name: "ahead_by",
        primer: parseInt,
        highToLow: true
    }, {
        name: "behind_by",
        primer: parseInt,
        highToLow: false
    }));

    console.log("Beginning of DOM operations!");
    forks.reverse().forEach(fork => {
        // console.log("TCL: fork", fork)
        const forkName = fork["full_name"]; // like: mcanthony/lovely-forks
        const starCount = fork["stargazers_count"];
        let hasRepo = false; // the repo is listed as a fork or not
        network.querySelectorAll("div.repo").forEach((repo) => {
            // like: mcanthony/lovely-forks, remove the first "/" in url by substring(1) in repoName
            const href = repo.lastElementChild.getAttribute("href");
            if (href) {
                const repoName = href.substring(1);
                if (repoName === forkName) {
                    hasRepo = true;
                    addStatus(repo);
                }
            }
        });
        if (!hasRepo) {
            // create repo display
            //<div class="repo">
            //  <img alt="" class="network-tree" src="https://github.githubassets.com/images/modules/network/t.png">
            //  <a class="d-inline-block" data-hovercard-type="organization" data-hovercard-url="/orgs/19dev/hovercard" href="/19dev"><img class="gravatar" src="https://avatars1.githubusercontent.com/u/388995?s=32&amp;v=4" width="16" height="16" alt="@19dev"></a>
            //  <a data-hovercard-type="organization" data-hovercard-url="/orgs/19dev/hovercard" href="/19dev">19dev</a>
            //     /
            //  <a href="/19dev/flatdoc">flatdoc</a>
            //</div>
            const repo = document.createElement("div");
            repo.classList.add("repo");

            // like: <img alt="" class="network-tree" src="https://github.githubassets.com/images/modules/network/t.png">
            const treeImg = document.createElement("img");
            treeImg.alt = "";
            treeImg.classList.add("network-tree");
            treeImg.src = "https://github.githubassets.com/images/modules/network/t.png";

            // like: <a data-hovercard-type="organization" data-hovercard-url="/orgs/19dev/hovercard" href="/19dev">19dev</a>
            const ownerType = fork["owner"]["type"].toLowerCase();
            const nameAnchor = document.createElement("a");
            nameAnchor.setAttribute("data-hovercard-type", ownerType);
            const ownerName = fork["owner"]["login"];
            if (ownerType === "user") {
                const userId = fork["owner"]["id"];
                nameAnchor.setAttribute("data-hovercard-url", `/hovercards?user_id=${userId}`);
            } else if (ownerType === "organization") {
                nameAnchor.setAttribute("data-hovercard-url", `/orgs/${ownerName}/hovercard`);
                nameAnchor.setAttribute("href", `/${ownerName}`);
            }
            nameAnchor.setAttribute("href", `/${ownerName}`);
            nameAnchor.setAttribute("data-octo-click", "hovercard-link-click");
            nameAnchor.setAttribute("data-octo-dimensions", "link_type:self");

            // like: <a class="d-inline-block" data-hovercard-type="organization" data-hovercard-url="/orgs/19dev/hovercard" href="/19dev"><img class="gravatar" src="https://avatars1.githubusercontent.com/u/388995?s=32&amp;v=4" width="16" height="16" alt="@19dev"></a>
            const gravatarAnchor = nameAnchor.cloneNode(true);
            gravatarAnchor.style.paddingLeft = "4px";
            gravatarAnchor.style.paddingRight = "4px";
            // add owner name to nameAnchor after being cloned to gravatarAnchor
            nameAnchor.innerText = ownerName;
            gravatarAnchor.classList.add("d-inline-block");
            // <img class="gravatar" src="https://avatars1.githubusercontent.com/u/388995?s=32&amp;v=4" width="16" height="16" alt="@19dev">
            const gravatar = document.createElement("img");
            gravatar.classList.add("gravatar");
            const gravatarUrl = fork["owner"]["avatar_url"];
            gravatar.src = gravatarUrl;
            gravatar.width = "16";
            gravatar.height = "16";
            gravatar.alt = `@${ownerName}`;
            gravatarAnchor.appendChild(gravatar);

            // like: <a href="/19dev/flatdoc">flatdoc</a>
            const repoAnchor = document.createElement("a");
            repoAnchor.style.paddingRight = "4px";
            repoAnchor.setAttribute("href", `/${forkName}`);
            repoAnchor.innerText = fork["name"];

            // Putting parts all together
            repo.appendChild(treeImg);
            repo.appendChild(gravatarAnchor);
            repo.appendChild(nameAnchor);
            repo.appendChild(document.createTextNode(" / "));
            repo.appendChild(repoAnchor);

            addStatus(repo);
        }

        // Finished sorting
        // remove loading gif
        loading.remove();

        function addStatus(repo) {
            const repoDocumentFragment = document.createDocumentFragment();
            repoDocumentFragment.appendChild(createIconSVG("star"));
            repoDocumentFragment.appendChild(document.createTextNode(starCount + " "));
            if (fork["ahead_by"] > 0) {
                const upIcon = createIconSVG("up");
                repoDocumentFragment.appendChild(upIcon);
                repoDocumentFragment.appendChild(document.createTextNode(fork["ahead_by"] + " "));
            }
            if (fork["ahead_by"] - fork["behind_by"] > 0) {
                repoDocumentFragment.appendChild(createIconSVG("flame"));
            }
            repo.appendChild(repoDocumentFragment);
            network.firstElementChild.insertAdjacentElement("afterend", repo);
        }
        console.log("TCL: starCount", fork["stargazers_count"]);
    });

    async function getFromApi(url, properties) {
        let json;
        let data = await fetch(url);
        if (data.ok) {
            json = await data.json();
        } else {
            throw new Error("Network response is not OK!");
        }
        if (typeof properties === "string") {
            return processPropertyChain(json, properties);
        } else if (Array.isArray(properties)) {
            return properties.map((property) => {
                return processPropertyChain(json, property);
            });
        }

        function processPropertyChain(json, property) {
            if (property.indexOf(".") >= 0) {
                let result = json;
                const propertyChain = property.split(".");
                propertyChain.forEach(property => {
                    result = result[property];
                });
                return result;
            } else {
                return json[property];
            }
        }
    }

    async function getDefaultBranch(repoName) {
        const defaultBranchUrl = processUrl(`https://api.github.com/repos/${repoName}`);
        return getFromApi(defaultBranchUrl, "default_branch");
    }

    // Source: https://stackoverflow.com/a/979325/6798201
    function sortBy(field, highToLow, primer) {

        var key = primer ?
            function (x) {
                return primer(x[field])
            } :
            function (x) {
                return x[field]
            };

        highToLow = !highToLow ? 1 : -1;

        return function (a, b) {
            return a = key(a), b = key(b), highToLow * ((a > b) - (b > a));
        }
    }

    // Source: https://stackoverflow.com/a/6913821/6798201
    function sortByMultipleFields() {
        var fields = [].slice.call(arguments),
            n_fields = fields.length;

        return function (A, B) {
            var a, b, field, key, primer, highToLow, result, i;

            for (i = 0; i < n_fields; i++) {
                result = 0;
                field = fields[i];

                key = typeof field === 'string' ? field : field.name;

                a = A[key];
                b = B[key];

                if (typeof field.primer !== 'undefined') {
                    a = field.primer(a);
                    b = field.primer(b);
                }

                highToLow = (field.highToLow) ? -1 : 1;

                if (a < b) result = highToLow * -1;
                if (a > b) result = highToLow * 1;
                if (result !== 0) break;
            }
            return result;
        }
    };

    // Based on: https://github.com/musically-ut/lovely-forks/blob/master/userscript/lovely-forks.user.js
    function createIconSVG(type) {
        const svgNS = 'http://www.w3.org/2000/svg';
        var svg = document.createElementNS(svgNS, 'svg');
        svg.setAttribute('height', 12);
        svg.setAttribute('width', 10.5);
        svg.setAttribute('viewBox', '0 0 14 16');
        svg.style['vertical-align'] = 'middle';
        svg.style['fill'] = 'currentColor';
        svg.style['position'] = 'relative';
        svg.style['bottom'] = '1px';

        svg.classList.add('opticon', 'opticon-' + type);

        var title = document.createElementNS(svgNS, 'title');

        var iconPath = document.createElementNS(svgNS, 'path');
        switch (type) {
            case 'star':
                title.appendChild(document.createTextNode('Number of real stars (excluding author\'s star)'));
                iconPath.setAttribute('d', 'M14 6l-4.9-0.64L7 1 4.9 5.36 0 6l3.6 3.26L2.67 14l4.33-2.33 4.33 2.33L10.4 9.26 14 6z');
                iconPath.setAttribute('fill', 'black');
                break;
            case 'up':
                title.appendChild(document.createTextNode('Number of commits ahead'));
                iconPath.setAttribute('d', 'M5 3L0 9h3v4h4V9h3L5 3z');
                iconPath.setAttribute('fill', '#84ed47');
                svg.setAttribute('viewBox', '0 0 10 16');
                svg.setAttribute('height', 16);
                break;
            case 'flame':
                title.appendChild(document.createTextNode('Fork may be more recent than upstream.'));
                iconPath.setAttribute('d', 'M5.05 0.31c0.81 2.17 0.41 3.38-0.52 4.31-0.98 1.05-2.55 1.83-3.63 3.36-1.45 2.05-1.7 6.53 3.53 7.7-2.2-1.16-2.67-4.52-0.3-6.61-0.61 2.03 0.53 3.33 1.94 2.86 1.39-0.47 2.3 0.53 2.27 1.67-0.02 0.78-0.31 1.44-1.13 1.81 3.42-0.59 4.78-3.42 4.78-5.56 0-2.84-2.53-3.22-1.25-5.61-1.52 0.13-2.03 1.13-1.89 2.75 0.09 1.08-1.02 1.8-1.86 1.33-0.67-0.41-0.66-1.19-0.06-1.78 1.25-1.23 1.75-4.09-1.88-6.22l-0.02-0.02z');
                iconPath.setAttribute('fill', '#d26911');
                break;
        }

        iconPath.appendChild(title);
        svg.appendChild(iconPath);

        return svg;
    }

    // Based on: https://codeburst.io/javascript-async-await-with-foreach-b6ba62bbf404
    async function asyncForEach(array, callback) {
        const promises = []
        for (let index = 0; index < array.length; index++) {
            promises.push(callback(array[index], index, array));
        }
        return Promise.all(promises);
    }

})()
