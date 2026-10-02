package shop;

import java.net.URISyntaxException;
import java.nio.file.Path;
import java.util.Random;

import org.openqa.selenium.WebDriver;
import org.openqa.selenium.chrome.ChromeDriver;
import org.openqa.selenium.chrome.ChromeOptions;

/** One headless Chrome per scenario, shared between step classes by cucumber-picocontainer. */
public class Browser {
    private static final Random RANDOM = new Random();
    private WebDriver driver;

    public WebDriver driver() {
        return driver;
    }

    public void start() {
        ChromeOptions options = new ChromeOptions();
        options.addArguments("--headless=new", "--window-size=1280,800");
        driver = new ChromeDriver(options);
    }

    public void quit() {
        if (driver != null) {
            driver.quit();
        }
    }

    /** The shop is a static page on the classpath, so the sample needs no web server. */
    public void openShop() throws URISyntaxException {
        driver.get(Path.of(getClass().getResource("/shop/shop.html").toURI()).toUri().toString());
    }

    /**
     * Used to make some scenarios fail now and then, so the dashboard has trends to show.
     * -Dsample.unlucky=1 (or 0) makes every such check fail (or pass), for reproducible reports.
     */
    public static boolean unlucky(double chance) {
        String forced = System.getProperty("sample.unlucky");
        return forced != null ? forced.equals("1") : RANDOM.nextDouble() < chance;
    }
}
