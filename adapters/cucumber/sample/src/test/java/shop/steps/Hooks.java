package shop.steps;

import io.cucumber.java.After;
import io.cucumber.java.Before;
import io.cucumber.java.Scenario;
import org.openqa.selenium.OutputType;
import org.openqa.selenium.TakesScreenshot;
import shop.Browser;

public class Hooks {
    private final Browser browser;

    public Hooks(Browser browser) {
        this.browser = browser;
    }

    @Before
    public void startBrowser() {
        browser.start();
    }

    @After
    public void stopBrowser(Scenario scenario) {
        if (scenario.isFailed() && browser.driver() != null) {
            byte[] screenshot = ((TakesScreenshot) browser.driver()).getScreenshotAs(OutputType.BYTES);
            scenario.attach(screenshot, "image/png", "screenshot");
        }
        browser.quit();
    }
}
