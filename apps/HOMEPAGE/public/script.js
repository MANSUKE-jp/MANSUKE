// Site Data Configuration
const siteConfig = {
    webApps: [
        { name: 'HIRUSUPA', url: 'https://hirusupa.mansuke.jp/', external: true },
        { name: 'WEREWOLF', url: 'https://werewolf.mansuke.jp/', external: true }
    ],
    legal: [
        { name: '利用規約', url: 'https://legal.mansuke.jp/terms/', external: true },
        { name: 'プライバシーポリシー', url: 'https://legal.mansuke.jp/privacy/', external: true },
        { name: 'コミュニティガイドライン', url: 'https://legal.mansuke.jp/community-guildline', external: true },
        { name: '特定商取引法に基づく表記', url: 'https://legal.mansuke.jp/tokusyoho', external: true },
        { name: 'アカウント残高およびPREPAID CARD 利用規約', url: 'https://legal.mansuke.jp/prepaid', external: true }
    ],
    contact: {
        formUrl: 'https://cerinal.fillout.com/mansuke-contact',
        address: '〒530-0011 大阪府大阪市北区大深町1-1 ヨドバシ梅田タワー8F WeWork LINKS UMEDA',
        email: 'support@mansuke.jp'
    }
};

const loader = document.getElementById('loader');
const loaderBar = document.getElementById('loader-bar');
const loaderText = document.getElementById('loader-text');
const mainContent = document.getElementById('main-content');

let progress = 0;
const totalDuration = 2500;
const intervalTime = 20;
const increment = 100 / (totalDuration / intervalTime);

const loadingInterval = setInterval(() => {
    progress += increment + Math.random();
    if (progress >= 100) {
        progress = 100;
        clearInterval(loadingInterval);
        finishLoading();
    }

    loaderBar.style.width = `${Math.min(100, progress)}%`;
    loaderText.innerText = `${Math.floor(progress)}%`;

}, intervalTime);

function finishLoading() {
    setTimeout(() => {
        gsap.to(loader, {
            y: '-100%',
            duration: 1.2,
            ease: 'power4.inOut',
            onComplete: initSite
        });
    }, 500);
}

function initSite() {
    renderNavigation();
    renderFooter();
    mainContent.classList.remove('opacity-0');
    initSlider();
    initScrollTrigger();

    // アイコンの再描画（動的に追加された要素のため）
    lucide.createIcons();
    addHoverEvents();
}

function renderNavigation() {
    const createLink = (item, isNav = true) => {
        const a = document.createElement('a');
        a.href = item.url;
        // Navigation Styles
        a.className = "menu-link hover-trigger font-display font-bold text-gray-400 hover:text-white transition-colors duration-300 transform translate-x-4 opacity-0 flex items-center";

        // Font size adjustment based on category or length could go here, but keeping standard
        // 文字サイズを少し小さく変更しました (3xl/4xl -> 2xl/3xl)
        a.classList.add('text-2xl', 'md:text-1xl');

        a.innerHTML = `<span>${item.name}</span>`;

        if (item.external) {
            a.innerHTML += `<i data-lucide="external-link" class="w-6 h-6 ml-3 opacity-70"></i>`;
            a.target = "_blank";
            a.rel = "noopener noreferrer";
        }
        return a;
    };

    // Render Web Apps
    const webAppsContainer = document.getElementById('nav-webapps');
    if (webAppsContainer) {
        webAppsContainer.innerHTML = '';
        siteConfig.webApps.forEach(app => {
            webAppsContainer.appendChild(createLink(app));
        });
    }

    // Render Legal
    const legalContainer = document.getElementById('nav-legal');
    if (legalContainer) {
        legalContainer.innerHTML = '';
        siteConfig.legal.forEach(item => {
            legalContainer.appendChild(createLink(item));
        });
    }
}

function renderFooter() {
    // Render Legal
    const legalFooterContainer = document.getElementById('footer-legal');
    if (legalFooterContainer) {
        legalFooterContainer.innerHTML = '';
        siteConfig.legal.forEach(item => {
            const a = document.createElement('a');
            a.href = item.url;
            a.className = "hover-trigger hover:opacity-60 transition-opacity text-sm md:text-base font-bold text-black/80 flex items-center";
            a.innerHTML = `<span>${item.name}</span>`;

            if (item.external) {
                a.innerHTML += `<i data-lucide="external-link" class="w-4 h-4 ml-1 opacity-70"></i>`;
                a.target = "_blank";
                a.rel = "noopener noreferrer";
            }
            legalFooterContainer.appendChild(a);
        });
    }

    // Render Contact
    const contactFooterContainer = document.getElementById('footer-contact');
    if (contactFooterContainer) {
        contactFooterContainer.innerHTML = '';
        const { formUrl, address, email } = siteConfig.contact;

        // Form URL
        const formLink = document.createElement('a');
        formLink.href = formUrl;
        formLink.className = "hover-trigger hover:opacity-60 transition-opacity text-xl font-medium flex items-center";
        formLink.target = "_blank";
        formLink.rel = "noopener noreferrer";
        formLink.innerHTML = `<span>Contact Form</span><i data-lucide="external-link" class="w-5 h-5 ml-2 opacity-70"></i>`;
        contactFooterContainer.appendChild(formLink);

        // Address
        const addressP = document.createElement('p');
        addressP.className = "text-sm leading-relaxed opacity-80 font-sans";
        addressP.innerText = address;
        contactFooterContainer.appendChild(addressP);
    }
}

const menuBtn = document.getElementById('menu-btn');
const menuOverlay = document.getElementById('menu-overlay');

let isMenuOpen = false;

menuBtn.addEventListener('click', () => {
    isMenuOpen = !isMenuOpen;
    document.body.classList.toggle('menu-open');

    // 動的に生成されたリンクを含めて再取得
    const menuLinks = document.querySelectorAll('.menu-link');

    if (isMenuOpen) {
        gsap.to('.menu-line-1', { rotation: 45, y: 8, duration: 0.3 });
        gsap.to('.menu-line-2', { rotation: -45, y: 0, width: '2rem', duration: 0.3 });

        gsap.to(menuLinks, {
            x: 0,
            opacity: 1,
            duration: 0.5,
            stagger: 0.05,
            delay: 0.3,
            ease: 'power3.out'
        });

        // クリックイベントの再設定（生成されたばかりの要素に対応）
        menuLinks.forEach(link => {
            link.onclick = () => {
                if (isMenuOpen) menuBtn.click();
            };
        });

    } else {
        gsap.to('.menu-line-1', { rotation: 0, y: 0, duration: 0.3 });
        gsap.to('.menu-line-2', { rotation: 0, y: 0, width: '1.5rem', duration: 0.3 });

        gsap.to(menuLinks, {
            x: 16,
            opacity: 0,
            duration: 0.3
        });
    }
});

const cursor = document.getElementById('cursor');

document.addEventListener('mousemove', (e) => {
    gsap.to(cursor, {
        x: e.clientX,
        y: e.clientY,
        duration: 0.1,
        ease: 'power2.out'
    });
});

const addHoverEvents = () => {
    // 動的要素に対応するため、再度取得
    const triggers = document.querySelectorAll('a, button, .hover-trigger');
    triggers.forEach(trigger => {
        trigger.addEventListener('mouseenter', () => cursor.classList.add('hovered'));
        trigger.addEventListener('mouseleave', () => cursor.classList.remove('hovered'));
    });
};

/* スクロール調整のポイント:
   - duration: 数値を大きくすると余韻が長くなり、ゆっくりに感じます (例: 1.2 -> 1.8)
   - mouseMultiplier: 1より小さくすると、マウスホイール1回あたりの移動量が減ります (例: 1 -> 0.8)
*/
const lenis = new Lenis({
    duration: 1.5, // ゆっくり滑らかにするために数値を上げました
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    direction: 'vertical',
    gestureDirection: 'vertical',
    smooth: true,
    mouseMultiplier: 0.8, // ホイールの感度を少し下げてゆっくり進むようにしました
    smoothTouch: false,
    touchMultiplier: 2,
});

function raf(time) {
    lenis.raf(time);
    requestAnimationFrame(raf);
}
requestAnimationFrame(raf);

const slidesData = [
    {
        image: "https://i.imghippo.com/files/VtZd2833iw.png",
        subtitle: "BREAKING",
        title: "HIRUSUPA <br> Ver3.0",
        desc: "内部処理を改善し、検索が高速になりました。",
        link: "https://hirusupa.mansuke.jp/"
    }
];

let slides;
let currentSlide = 0;
const slideIntervalTime = 5000;
let slideTimeline;

const textContainer = document.getElementById('slide-text-content');
const slideTitle = document.getElementById('slide-title');
const slideDesc = document.getElementById('slide-desc');
const slideSubtitle = document.getElementById('slide-subtitle');
const slideLink = document.getElementById('slide-link'); // Added: リンク要素を取得
const currentSlideEl = document.getElementById('current-slide');
const totalSlidesEl = document.getElementById('total-slides');
const progressEl = document.getElementById('slide-progress');

function initSlider() {
    const sliderContainer = document.getElementById('slider-container');

    sliderContainer.innerHTML = '';
    slidesData.forEach((data, index) => {
        const slideDiv = document.createElement('div');
        slideDiv.className = 'slide absolute inset-0 w-full h-full opacity-0 transition-opacity duration-1000 ease-in-out';

        const img = document.createElement('img');
        img.src = data.image;
        img.alt = `Slide ${index + 1}`;
        img.className = 'slide-image w-full h-full object-cover';
        img.style.transition = 'none';

        const overlay = document.createElement('div');
        overlay.className = 'absolute inset-0';
        overlay.style.background = 'linear-gradient(90deg, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.8) 40%, rgba(0,0,0,0) 80%)';

        slideDiv.appendChild(img);
        slideDiv.appendChild(overlay);
        sliderContainer.appendChild(slideDiv);
    });

    slides = document.querySelectorAll('.slide');

    if (totalSlidesEl) {
        totalSlidesEl.innerText = String(slidesData.length).padStart(2, '0');
    }

    updateSlideText(0);

    if (slides.length > 0) {
        slides[0].classList.add('slide-active');
        slides[0].style.opacity = 1;
        gsap.set(slides[0].querySelector('img'), {
            scale: 1.05,
            filter: 'grayscale(0%) contrast(110%)'
        });
        startSliderAnimation();
    }
}

function updateSlideText(index) {
    const data = slidesData[index];
    slideSubtitle.innerText = data.subtitle;
    slideTitle.innerHTML = data.title;
    slideDesc.innerText = data.desc;

    // Added: リンク先を更新する処理
    if (slideLink) {
        slideLink.href = data.link;
    }
}

function startSliderAnimation() {
    if (slidesData.length <= 1) return;

    slideTimeline = gsap.timeline({ repeat: -1, onRepeat: nextSlide });
    slideTimeline.fromTo(progressEl,
        { width: '0%' },
        { width: '100%', duration: slideIntervalTime / 1000, ease: 'linear' }
    );
}

function nextSlide() {
    const nextIndex = (currentSlide + 1) % slides.length;
    const data = slidesData[nextIndex];

    gsap.to(textContainer, {
        y: 30,
        opacity: 0,
        duration: 0.5,
        ease: "power2.in",
        onComplete: () => {
            updateSlideText(nextIndex);

            gsap.fromTo(textContainer,
                { y: -30, opacity: 0 },
                { y: 0, opacity: 1, duration: 0.8, ease: "power2.out" }
            );
        }
    });

    const currentImg = slides[currentSlide].querySelector('img');
    const nextImg = slides[nextIndex].querySelector('img');

    gsap.to(slides[currentSlide], { opacity: 0, duration: 1 });
    gsap.to(currentImg, {
        filter: 'grayscale(100%) contrast(120%)',
        scale: 1.05,
        duration: 1
    });
    slides[currentSlide].classList.remove('slide-active');

    gsap.to(slides[nextIndex], { opacity: 1, duration: 1 });
    gsap.fromTo(nextImg,
        {
            scale: 1.05,
            filter: 'grayscale(100%) contrast(120%)'
        },
        {
            scale: 1.05,
            filter: 'grayscale(0%) contrast(110%)',
            duration: 1
        }
    );
    slides[nextIndex].classList.add('slide-active');

    currentSlide = nextIndex;
    currentSlideEl.innerText = String(currentSlide + 1).padStart(2, '0');
}

gsap.registerPlugin(ScrollTrigger);

function initScrollTrigger() {
    const appsSection = document.getElementById('apps-section');
    const appsWrapper = document.getElementById('apps-wrapper');

    let getScrollAmount = () => -(appsWrapper.scrollWidth - window.innerWidth);

    const tween = gsap.to(appsWrapper, {
        x: getScrollAmount,
        ease: "none"
    });

    ScrollTrigger.create({
        trigger: appsSection,
        start: "top top",
        end: () => `+=${appsWrapper.scrollWidth - window.innerWidth}`,
        pin: true,
        animation: tween,
        scrub: 1,
        invalidateOnRefresh: true,
    });

    const animatedTexts = document.querySelectorAll('.animate-on-scroll');

    // アニメーションのパフォーマンス改善のため、一括ではなく個別に設定し、force3Dを有効化
    animatedTexts.forEach((text, i) => {
        gsap.to(text, {
            y: 0,
            opacity: 1,
            duration: 1.2, // 少しゆっくりにしてスムーズに
            ease: 'power3.out',
            force3D: true, // ハードウェアアクセラレーションを強制
            scrollTrigger: {
                trigger: text,
                start: 'top 85%', // 発火位置を少し早めに
            }
        });
    });

    document.querySelectorAll('#apps-section img').forEach(img => {
        img.classList.remove('slide-image');
    });

    ScrollTrigger.refresh();
}

lucide.createIcons();