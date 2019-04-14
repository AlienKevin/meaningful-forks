# meaningful-forks
Sort Github fork lists by the number of stars and commits ahead from the source repo. 

![Angular forks](./demos/angular-forks.png)

## Features
* Sort forks according to the number of effective stars (excluding fork author's own star)
* Sort forks according to the number of commits ahead from the source repo (displayed using a green up arrow)
* Show a flame symbol for forks more recent than the source repo

## Installation
1. Install Tampermonkey for managing userscripts on [Chrome](https://openuserjs.org/about/Tampermonkey-for-Chrome), [Chromium](https://openuserjs.org/about/Tampermonkey-for-Chromium), [Firefox](https://openuserjs.org/about/Tampermonkey-for-Firefox), [Opera](https://openuserjs.org/about/Tampermonkey-for-Opera), or [Safari](https://openuserjs.org/about/Tampermonkey-for-Safari).
2. Add script for meaningful-forks from `dist/script.js` to Tampermonkey
3. Add Userscript header to the top of Tampermonkey script
    ```js
    // ==UserScript==
    // @name         meaningful-forks
    // @namespace    http://tampermonkey.net/
    // @version      0.1
    // @description  Sort Github fork lists by the number of stars and commits ahead from the source repo.
    // @author       Kevin Li
    // @match        https://github.com/*/network/members
    // @grant        none
    // ==/UserScript==
    ```

Now you can use meaningful-forks on any github page. To test this, go to the [fork page for Angular](https://github.com/angular/angular/network/members). Your page should look similar to the demo image above.

## Credits
Inspired by [lovely-forks](https://github.com/musically-ut/lovely-forks/) by Utkarsh Upadhyay.