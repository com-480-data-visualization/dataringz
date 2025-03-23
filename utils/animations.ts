import SplitType from 'split-type';
import { gsap } from 'gsap';


// DISPLAY / HIDE SKIP BUTTON --------------------------------------------------------------------------------------- //
const displaySkipButton = (showSkipButton: Ref, skipButton: Ref) => {
    gsap.delayedCall(3, () => {
        showSkipButton.value = true;
        nextTick(() => {
            gsap.fromTo(
                skipButton.value,
                { opacity: 0 },
                { opacity: 1, duration: 4, ease: 'power4.out' }
            );
        });
    })
};

// DISPLAY TEXT ----------------------------------------------------------------------------------------------------- //
const displayText = async (showText: Ref, textContainer: Ref, currentText: Ref, text: string, duration: number) => {
    showText.value = true;
    currentText.value = text;
    await nextTick();

    gsap.fromTo(
        textContainer.value,
        { opacity: 0, width: 'auto' },
        { opacity: 1, duration: 1, ease: 'power4.out' }
    );

    const chars = SplitType.create(".text", { types: 'chars' }).chars
    gsap.fromTo(
        chars,
        {
            y: 10,
            opacity: 0,
        },
        {
            y: 0,
            opacity: 1,
            stagger: 0.01,
            duration: 1,
            ease: 'power4.out'
        }
    );
    gsap.delayedCall(duration, () => {
        gsap.to(
            textContainer.value,
            {
                opacity: 0,
                duration: 1,
                ease: 'power4.out',
                onComplete: () => {
                    showText.value = false;
                }
            });
    });
};

export { displaySkipButton, displayText };