import sys
import unittest
from nlp_module import nlp_module

class TestNlpModule(unittest.TestCase):

    def test_target_workflow(self):
        text = "Medical emergency. Five people are injured. Please send help."
        res = nlp_module.extract_facts(text)
        self.assertTrue(res["isEmergency"])
        self.assertEqual(res["intent"], "MEDICAL")
        self.assertEqual(res["facts"]["peopleCount"], 5)
        self.assertEqual(res["facts"]["injuredCount"], 5)
        self.assertIn("injury", res["facts"]["severitySignals"])

    def test_fire_emergency(self):
        text = "Fire in the building, heavy smoke and flames."
        res = nlp_module.extract_facts(text)
        self.assertTrue(res["isEmergency"])
        self.assertEqual(res["intent"], "FIRE")
        self.assertTrue(res["facts"]["fire"])

    def test_rescue_trapped(self):
        text = "Two children are trapped under debris after wall collapsed."
        res = nlp_module.extract_facts(text)
        self.assertTrue(res["isEmergency"])
        self.assertEqual(res["intent"], "RESCUE")
        self.assertTrue(res["facts"]["trapped"])
        self.assertEqual(res["facts"]["childrenCount"], 2)

    def test_accident(self):
        text = "Severe road accident involving two cars, three people hurt."
        res = nlp_module.extract_facts(text)
        self.assertTrue(res["isEmergency"])
        self.assertEqual(res["intent"], "ACCIDENT")
        self.assertEqual(res["facts"]["peopleCount"], 3)

    def test_flood(self):
        text = "Severe flooding in our ward, water is rising rapidly."
        res = nlp_module.extract_facts(text)
        self.assertTrue(res["isEmergency"])
        self.assertEqual(res["intent"], "FLOOD")

    def test_edc_trigger(self):
        text = "Reporting EDC incident at Howrah."
        res = nlp_module.extract_facts(text)
        self.assertTrue(res["isEmergency"])
        self.assertEqual(res["intent"], "EDC")

    def test_edc_only(self):
        text = "EDC"
        res = nlp_module.extract_facts(text)
        self.assertTrue(res["isEmergency"])
        self.assertEqual(res["intent"], "EDC")

    def test_help_trigger(self):
        text = "Please send help immediately, we are in danger."
        res = nlp_module.extract_facts(text)
        self.assertTrue(res["isEmergency"])
        self.assertEqual(res["intent"], "HELP")

    def test_negation_fire(self):
        text = "There is no fire here, false alarm."
        res = nlp_module.extract_facts(text)
        self.assertFalse(res["isEmergency"])

    def test_negation_safe(self):
        text = "I am safe, no emergency."
        res = nlp_module.extract_facts(text)
        self.assertFalse(res["isEmergency"])
        self.assertEqual(res["intent"], "SAFE")

    def test_negation_cancel(self):
        text = "Cancel emergency, it was a mistake."
        res = nlp_module.extract_facts(text)
        self.assertFalse(res["isEmergency"])
        self.assertEqual(res["intent"], "CANCEL")

    def test_inquiry(self):
        text = "Who are you and what is SevaSetu?"
        res = nlp_module.extract_facts(text)
        self.assertFalse(res["isEmergency"])
        self.assertEqual(res["intent"], "INFO")

    def test_deterministic_fallback_directly(self):
        # Directly test deterministic engine without LLM
        res = nlp_module._deterministic_extract("Medical emergency. Five people are injured. Please send help.")
        self.assertTrue(res["isEmergency"])
        self.assertEqual(res["intent"], "MEDICAL")
        self.assertEqual(res["facts"]["peopleCount"], 5)
        self.assertEqual(res["facts"]["injuredCount"], 5)

        res_edc = nlp_module._deterministic_extract("EDC emergency at ward 5")
        self.assertTrue(res_edc["isEmergency"])
        self.assertEqual(res_edc["intent"], "EDC")

        res_neg = nlp_module._deterministic_extract("There is no fire here, false alarm.")
        self.assertFalse(res_neg["isEmergency"])

if __name__ == '__main__':
    unittest.main()
