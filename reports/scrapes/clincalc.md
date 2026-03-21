[About](https://clincalc.com/About.aspx) [Blog](https://clincalc.com/blog) [Academy](https://academy.clincalc.com/) [Home](https://clincalc.com/)

Menu

# Vancomycin Calculator

## Pharmacokinetic calculator with Bayesian modeling

### [ClinCalc.com](https://clincalc.com/) » [Infectious Disease](https://clincalc.com/InfectiousDisease) » Vancomycin Calculator

### Patient Parameters

|     |     |
| --- | --- |
| Actual body weight: | kglbs |
| Height: | incm |
| Gender: | MaleFemale |
| Patient is critically ill ![Help](https://clincalc.com/images/icon-question.png) | NoYes |

### Pharmacokinetic Modeling

|     |     |
| --- | --- |
| Clearance method: ![Help](https://clincalc.com/images/icon-question.png) | Bayesian modeling population estimatesBauer (CLvanco = 0.695\*CrCl+0.05)Matzke (CLvanco = 0.689\*CrCl+3.66) |
| Volume of distribution (Vd): ![Help](https://clincalc.com/images/icon-question.png) | Bayesian modeling population estimatesBauer (0.7 L/kg)Matzke (0.89 or 0.72 L/kg)Rushing-Ambrose (0.17\*Age+0.22\*TotalBW+15)Morbidily obese (0.52 L/kg)User-specified Vd (enter a custom Vd) |
| User-specified Vd | L/kg |
| Recommend loading dose: [![Help](https://clincalc.com/images/icon-question.png)](https://clincalc.com/Vancomycin/#LoadingDose) | NoYes |

### Renal Function

|     |     |     |
| --- | --- | --- |
| Renal function: | Not receiving dialysis (no renal replacement therapy)Any form of renal replacement therapy (dialysis) |
| Creatinine: | mg/dLµmol/L | [Manually enter\\
\\
creatinine clearance »](https://clincalc.com/Vancomycin/#)

|     |     |
| --- | --- |
| CrCl: | mL/min | |
| Age: | years |
| |     |     |
| --- | --- |
|  | See [dosing recommendations for renal replacement therapy](https://clincalc.com/Vancomycin/#RRT). This calculator is not designed for patients receiving any form of renal replacement therapy (such as intermittent hemodialysis, SLED, or CRRT). | |

### Vancomycin Drug Levels

| Drug levels available: | NoYes |
| Doses of vancomycin given to patient | 13 or more (steady state) |
| Most Recent Dose | mgevery 68121824364872hoursx1 dose infused over hour(s) |
| Time Most Recent Dose Started |  |
| Drug Levels | | Date/Time | Level |  |
| --- | --- | --- |
|  | mcg/mL |  |
|  | mcg/mL | No second level |
| **Note:** Although it is possible to estimate AUC using a single level, pharmacokinetic estimations are most accurate with two levels. [Learn more about the timing of vancomycin drug levels](https://clincalc.com/Vancomycin/#DrugLevels). |
| **Note:** No vancomycin should have been given between the two levels | |
| Time from dose to 1st level |  |
| Time from 1st level to 2nd level |  |
| Enter a valid time for "Time Dose Started" |

Empiric, initial vancomycin dosing will be calculated using population pharmacokinetic parameters. Two vancomycin drug concentrations (such as a peak and trough) should be obtained to optimize therapy. [Learn more about the timing of vancomycin drug levels](https://clincalc.com/Vancomycin/#DrugLevels).

Advanced Settings


US units

Looking for the previous version of this calculator? See [the retired version](https://clincalc.com/Vancomycin/Retired.aspx) that uses trough-based vancomycin goals without advanced modeling techniques.

[![Brand and generic drug name crossword puzlzes workbook - Available at Amazon](https://clincalc.com/images/promo/crossword-horizontal.jpg)![](<Base64-Image-Removed>)](https://amzn.to/3LQUmRs)

Press 'Calculate' to view calculation results.



[Load an Example](https://clincalc.com/Vancomycin/?example)

### About This Calculator

This vancomycin calculator uses pharmacokinetic population estimates, Bayesian modeling, and the Sawchuk-Zaske method to calculate a vancomycin dosing regimen for an adult patient. Vancomycin regimens can be calculated both empirically (without any prior doses) or using one or two vancomycin levels.

This calculator determines pharmacokinetic parameters and vancomycin dosing strategies using the following steps:

1\. Estimate CLvanco and Vd

**Empiric dosing (no drug levels):** CLvanco and Vd are determined using population estimates from [pharmacokinetic models](https://clincalc.com/Vancomycin/#PkModels). CLvanco is determined using whichever "Clearance method" is selected (see [Methods for Determining Vancomycin Clearance](https://clincalc.com/Vancomycin/#ClearanceMethods)). Vd is determined using the selected Vd method (see [Methods for Determining Vancomycin Volume of Distribution](https://clincalc.com/Vancomycin/#VdMethods)).

**One drug level available (trough):** Vd is assumed using either a population estimate or a user-specified Vd. Clearance is then determined using the following steps:

1. Using a population estimate of clearance, extrapolate a true trough (if drug level drawn early or late)



Cp=Cp0∗e−ktCp=Cp0∗e−kt

2. Using a population estimate of Vd, extrapolate a peak value:



ExtrapolatedPeak=Dose/TinfKel∗Vd∗(1−e−Kel∗Tinf)+TroughExtrapolatedPeak=Dose/TinfKel∗Vd∗(1−e−Kel∗Tinf)+Trough

3. Using the extrapolated peak and trough values, calculate Kel and CLvanco:



Kel=ln(Peak/Trough)/(Tau−Tinf)CLvanco=Vd∗KelKel=ln(Peak/Trough)/(Tau−Tinf)CLvanco=Vd∗Kel


**Two drug levels available (peak and trough):** This is the most accurate method of calculating a patient-specific CLvanco and Vd; however, it requires two drug levels to be drawn. These patient-specific pharmacokinetic values can be calculated using the [Sawchuk-Zaske method](https://clincalc.com/Vancomycin/#SawchukZaske).

2\. Optimize CLvanco and Vd using [Bayesian modeling](https://clincalc.com/Vancomycin/#BayesianModeling) (if selected)

If a single drug level is available, Bayesian modeling can be used to optimize the population estimates of CLvanco and Vd. This feature can be disabled by selecting "Population Estimates" in the "Preferred modeling method" setting.

Bayesian modeling uses a population estimate of CLvanco and Vd (called a Bayesian prior) and optimizes these estimates using a single drug level. As an example, Bayesian modeling may optimize a Vd value from 0.98 L/kg (the population estimate) to 1.11 L/kg (an optimized value based on the patient's drug level). See [Vancomycin Bayesian Modeling](https://clincalc.com/Vancomycin/#BayesianModeling) for more information.

Bayesian modeling is not conducted when no drug levels are available (a level is necessary for the model) nor when two drug levels are available (the Sawchuk-Zaske method is more reliable).

3\. Use one-compartment PK equations to estimate peak, trough, and AUC/MIC

Once CLvanco, Vd, and Kel are determined, one-compartment pharmacokinetic equations can be used to determine the peak, trough, and AUC/MIC for a given regimen:

Predicted Peak and Trough

Cpeak=Dose∗(1−e(−Kel∗Tinf))Tinf∗Vd∗Kel∗(1−e(−Kel∗Tau))Ctrough=Cpeak∗e(−k∗(Tau−Tinf))Cpeak=Dose∗(1−e(−Kel∗Tinf))Tinf∗Vd∗Kel∗(1−e(−Kel∗Tau))Ctrough=Cpeak∗e(−k∗(Tau−Tinf))

AUC Method #1

Lintrap=Ctrough+Cpeak2∗(Tinf)Logtrap=(Cpeak−Ctrough)∗(Tau−Tinf)ln(CpeakCtrough)AUC0−Tau=(Lintrap)+(Logtrap)AUC0−24=AUC0−Tau∗(24/Tau)=AUCinmcg∗h/mLLintrap=Ctrough+Cpeak2∗(Tinf)Logtrap=(Cpeak−Ctrough)∗(Tau−Tinf)ln⁡(CpeakCtrough)AUC0−Tau=(Lintrap)+(Logtrap)AUC0−24=AUC0−Tau∗(24/Tau)=AUCinmcg∗h/mL

AUC Method #2

CLvanco=Kel∗VdAUC0−24=(Totaldailyvancomycindose)/CLvancoCLvanco=Kel∗VdAUC0−24=(Totaldailyvancomycindose)/CLvanco

Convert AUC to AUC:MIC ratio over 24 hours

AUC0−24:MIC=AUC0−24MICAUC0−24:MIC=AUC0−24MIC

* * *

### Additional Information

- **Modeling and Pharmacokinetic Calculations**
- [Vancomycin Pharmacokinetic Models and Population Estimates](https://clincalc.com/Vancomycin/#PkModels)
- [Methods for Determining Vancomycin Clearance](https://clincalc.com/Vancomycin/#ClearanceMethods)
- [Methods for Determining Vancomycin Volume of Distribution](https://clincalc.com/Vancomycin/#VdMethods)
- [Vancomycin Bayesian Modeling for CLvanco and Vd](https://clincalc.com/Vancomycin/#BayesianModeling)
- [Sawchuk-Zaske Method for Kel and Vd](https://clincalc.com/Vancomycin/#SawchukZaske)
- **Vancomycin Drug Levels and Dosing**
- [Vancomycin Drug Levels](https://clincalc.com/Vancomycin/#DrugLevels)
- [Vancomycin Loading Dose](https://clincalc.com/Vancomycin/#LoadingDose)
- **Special Populations**
- [Inappropriate Populations for This Calculator](https://clincalc.com/Vancomycin/#InappropriatePopulations)
- [Dosing Recommendations for Renal Replacement Therapy (RRT)](https://clincalc.com/Vancomycin/#RRT)
- **More Information**
- [Frequently Asked Questions](https://clincalc.com/Vancomycin/#FAQ)
- [References and Additional Reading](https://clincalc.com/Vancomycin/#References)

* * *

#### Vancomycin Pharmacokinetic Models and Population Estimates

When CLvanco or Vd are unknown, population estimates are used based on published literature. In many pharmacokinetic textbooks, a single Vd (such as 0.7 L/kg) or CLvanco (such as 70% of creatinine clearance) are recommended. Literature demonstrates that these population estimates vary widely in certain patient populations, such as morbidly obese or critically ill patients. Given that, this calculator selects one of four possible pharmacokinetic models to estimate a patient's pharmacokinetic parameters:

- **Buelga _et. al_, 2005:** [1](https://clincalc.com/Vancomycin/#1) Default model for general hospitalized adult patients
- **Adane _et. al_, 2015:** [2](https://clincalc.com/Vancomycin/#2) Extreme obesity model (BMI > 40 kg/m2 and body weight ≥ 120 kg)
- **Roberts _et. al_, 2011:** [3](https://clincalc.com/Vancomycin/#3) Critically ill patient model for ICU patients (BMI < 30 kg/m2)
- **Masich _et. al_, 2020:** [4](https://clincalc.com/Vancomycin/#4) Critically ill and obesity model (BMI ≥ 30 kg/m2 and body weight > 100 kg)

There are many models available for pharmacokinetic and Bayesian analyses. [5](https://clincalc.com/Vancomycin/#5), [6](https://clincalc.com/Vancomycin/#6) These models were selected based on being generalizable, one-compartment models with reasonable predictive performance in confirmatory publications.

These four models vary significantly between each other given the difference in patient populations modeled, emphasizing the importance that the most representative model is selected for an individual patient. Using an example patient weighing 100 kg with a creatinine clearance of 80 mL/min and BSA of 2.3 m2, the initial pharmacokinetic variables with each model would be:

| Model | Intended patient population | CLvanco (L/hr) | Vd (L/kg) | Half-life (hr) |
| --- | --- | --- | --- | --- |
| Buelga 2005 [1](https://clincalc.com/Vancomycin/#1) | General hospitalized | 5.18 | 0.98 | 13.1 |
| Adane 2015 [2](https://clincalc.com/Vancomycin/#2) | Extreme obesity | 4.19 | 0.51 | 8.4 |
| Roberts 2011 [3](https://clincalc.com/Vancomycin/#3) | Critically ill | 4.65 | 1.53 | 22.8 |
| Masich 2020 [4](https://clincalc.com/Vancomycin/#4) | Critically ill and obesity | 5.21 | 0.78 | 10.4 |

#### Methods for Determining Vancomycin Clearance

The following methods can be used to estimate vancomycin clearance

##### Bayesian modeling population estimates \[Preferred Method\]

CLvanco is estimated using the most appropriate [published pharmacokinetic model](https://clincalc.com/Vancomycin/#PkModels) for a given patient. The following equations are used as part of these models:

| Model | Intended patient population | CLvanco Equation |
| --- | --- | --- |
| Buelga 2005 [1](https://clincalc.com/Vancomycin/#1) | General hospitalized | CrCl∗60/1000∗1.08CrCl∗60/1000∗1.08 |
| Adane 2015 [2](https://clincalc.com/Vancomycin/#2) | Extreme obesity | 6.54∗CrClTotalBW/1256.54∗CrClTotalBW/125 |
| Roberts 2011 [3](https://clincalc.com/Vancomycin/#3) | Critically ill | 4.58∗CrClper1.73m2/1004.58∗CrClper1.73m2/100 |
| Masich 2020 [4](https://clincalc.com/Vancomycin/#4) | Critically ill and obesity | 3.23∗(CrCl/40)0.693.23∗(CrCl/40)0.69 |

##### Bauer Method [7](https://clincalc.com/Vancomycin/\#7)

CLvanco is estimated using a linear relationship to creatinine clearance while normalizing to total body weight:

CLvanco=(0.695∗CrCl/TotalBW+0.05)∗TotalBW∗0.06CLvanco=(0.695∗CrCl/TotalBW+0.05)∗TotalBW∗0.06

##### Matzke Method [8](https://clincalc.com/Vancomycin/\#8)

CLvanco is estimated using a linear relationship to creatinine clearance:


CLvanco=(0.698∗CrCl+3.66)∗0.06CLvanco=(0.698∗CrCl+3.66)∗0.06

Note that this method comes from the same manuscript that published the linear relationship between Kel and CrCl (Kel=0.00083\*CrCl+0.0044), sometimes called the Creighton equation.

#### Methods for Determining Vancomycin Volume of Distribution

The following methods can be used to estimate vancomycin volume of distribution (Vd)

##### Bayesian modeling population estimates \[Preferred Method\]

Vd is estimated using the most appropriate [published pharmacokinetic model](https://clincalc.com/Vancomycin/#PkModels) for a given patient. The following Vd values are used as part of these models:

| Model | Intended patient population | Vd (L/kg TotalBW) |
| --- | --- | --- |
| Buelga 2005 [1](https://clincalc.com/Vancomycin/#1) | General hospitalized | 0.98 |
| Adane 2015 [2](https://clincalc.com/Vancomycin/#2) | Extreme obesity | 0.51 |
| Roberts 2011 [3](https://clincalc.com/Vancomycin/#3) | Critically ill | 1.53 |
| Masich 2020 [4](https://clincalc.com/Vancomycin/#4) | Critically ill and obesity | 0.78 |

##### Bauer Method [7](https://clincalc.com/Vancomycin/\#7)

Vd is a fixed value of 0.7 L/kg. This value is commonly used in pharmacokinetic textbooks.

##### Matzke Method [8](https://clincalc.com/Vancomycin/\#8)

Vd estimates are determined based on creatinine clearance:

| CrCl (mL/min) | Vd (L/kg) |
| --- | --- |
| \> 60 | 0.72 |
| ≤ 60 | 0.89 |

##### Rushing-Ambrose Method [9](https://clincalc.com/Vancomycin/\#9)

Vd estimates are determined using an equation incorporating age (in years) and total body weight (in kg):

Vd(liters)=0.17∗Age+0.22∗TotalBW+15Vd(L/kg)=Vd(liters)/TotalBW(kg)Vd(liters)=0.17∗Age+0.22∗TotalBW+15Vd(L/kg)=Vd(liters)/TotalBW(kg)

##### Morbid Obesity [2](https://clincalc.com/Vancomycin/\#2), [10](https://clincalc.com/Vancomycin/\#10)

Among non-critically ill, morbidly obese patients (defined as BMI > 40 kg/m2 and body weight ≥ 120 kg), Vd (L/kg) is smaller per kilogram of total body weight. Although values are highly variable, a Vd of 0.52 L/kg is a reasonable population estimate supported by the literature.

##### User-Specified Vd

For users who would like to use a specific volume of distribution value (L/kg), this option can be selected.

#### Vancomycin Bayesian Modeling for CLvanco and Vd

Bayesian modeling can be used to estimate a patient's vancomycin clearance (CLvanco) and volume of distribution (Vd) on the basis of one single vancomycin level either at steady state or even after one single dose. Bayesian modeling is a mathematically complex process that involves the following steps:

1. Identify a publication describing mean and variance of vancomycin clearance and volume of distribution. This publication should include subjects with similar characteristics to the patient who will be receiving vancomycin.
2. One or more vancomycin concentrations are drawn from a patient.
3. An algorithm identifies values for CLvanco and Vd that are most likely (using probability) to explain the patient's serum drug concentrations. These values are optimized based on the original publication's mean and variances of CLvanco and Vd.
4. With a known CLvanco and Vd, an elimination constant (Kel) can be calculated (Kel=CLvanco/VdKel=CLvanco/Vd)

5. Once the most likely values of Kel and Vd have been estimated, one-compartment pharmacokinetic equations are used to identify a dose and its associated peak, trough, and AUC/MIC values.

A Brief Introduction to Vancomycin Bayesian Modeling - YouTube

[Photo image of ClinCalc](https://www.youtube.com/channel/UC9FSoc9h3RM5bjMt431RszQ?embeds_referring_euri=https%3A%2F%2Fclincalc.com%2F)

ClinCalc

1.08K subscribers

[A Brief Introduction to Vancomycin Bayesian Modeling](https://www.youtube.com/watch?v=PRZKVvl4WIE)

ClinCalc

Search

Watch later

Share

Copy link

Info

Shopping

Tap to unmute

If playback doesn't begin shortly, try restarting your device.

More videos

## More videos

You're signed out

Videos you watch may be added to the TV's watch history and influence TV recommendations. To avoid this, cancel and sign in to YouTube on your computer.

CancelConfirm

Share

Include playlist

An error occurred while retrieving sharing information. Please try again later.

[Watch on](https://www.youtube.com/watch?v=PRZKVvl4WIE&embeds_referring_euri=https%3A%2F%2Fclincalc.com%2F)

0:00

0:00 / 9:11

•Live

•

#### Sawchuk-Zaske Method for Kel and Vd

A Brief Introduction to Vancomycin Dosing with the Sawchuk-Zaske Method - YouTube

[Photo image of ClinCalc](https://www.youtube.com/channel/UC9FSoc9h3RM5bjMt431RszQ?embeds_referring_euri=https%3A%2F%2Fclincalc.com%2F)

ClinCalc

1.08K subscribers

[A Brief Introduction to Vancomycin Dosing with the Sawchuk-Zaske Method](https://www.youtube.com/watch?v=ZuqZYoWoTw8)

ClinCalc

Search

Watch later

Share

Copy link

Info

Shopping

Tap to unmute

If playback doesn't begin shortly, try restarting your device.

More videos

## More videos

You're signed out

Videos you watch may be added to the TV's watch history and influence TV recommendations. To avoid this, cancel and sign in to YouTube on your computer.

CancelConfirm

Share

Include playlist

An error occurred while retrieving sharing information. Please try again later.

[Watch on](https://www.youtube.com/watch?v=ZuqZYoWoTw8&embeds_referring_euri=https%3A%2F%2Fclincalc.com%2F)

0:00

0:00 / 3:57

•Live

•

When multiple vancomycin drug concentrations are available, traditional pharmacokinetic equations can be implemented to calculate patient-specific pharmacokinetic parameters. This approach is called the Sawchuk-Zaske method. [11](https://clincalc.com/Vancomycin/#11) Unlike in Bayesian analysis, this method does not utilize population estimates of kinetic parameters and should provide more reliable results, particularly in patients with very altered pharmacokinetics values.

The Sawchuk-Zaske method uses two post-dose concentrations (regardless of being at steady state) using the following approach: [11](https://clincalc.com/Vancomycin/#11)

##### 1\. Determine Kel

Cp=Cp0∗e−kt(rewrittentosolvefork)k=ln(Cp0/Cp)/tCp=Cp0∗e−kt(rewrittentosolvefork)k=ln(Cp0/Cp)/t

Cp0 is the first (higher) concentration; Cp is the second (lower) concentration; t is the time elapsed between Cp0 and Cp; k is the elimination constant (Kel)

##### 2\. Extrapolate to Cmax (peak) and Cmin (trough)

Using the first-order elimination equation (Cp=Cp0∗e−ktCp=Cp0∗e−kt), a true peak (Cmax) can be calculated using the time elapsed between the end of the vancomycin infusion and the first drug concentration (Cp0). Similarly, a true trough (Cmin) can be calculated using the time elapsed between the second drug concentration (Cp) and the when the next dose is due to begin infusing.

##### 3\. Calculate volume of distribution (Vd)

A patient-specific Vd can be calculated using Cmax and Cmin from the previous step. If a patient has only received one single dose (thus not at steady state), Cmin is set to 0 (zero).

Vd=Dose/Tinf∗(1−e−k∗Tinf)k∗(Cmax−(Cmin∗e−k∗Tinf))Vd=Dose/Tinf∗(1−e−k∗Tinf)k∗(Cmax−(Cmin∗e−k∗Tinf))

Vd is the volume of distribution (in liters); dose is the vancomycin dose (in milligrams); Tinf is the vancomycin infusion time (in hours); k is the elimination constant (Kel, in hr-1); Cmax is the true peak concentration; Cmin is the true trough concentration (if at steady state) or is 0 (zero) if not at steady state

##### 4\. Use patient-specific Kel and Vd for additional calculations

Once patient-specific values of Kel and Vd have been determined, traditional one-compartment pharmacokinetic equations are used to identify a dose and its associated peak, trough, and AUC/MIC values.

#### Vancomycin Drug Level Monitoring

The most optimal method of monitoring vancomycin therapy is to obtain two drug levels (such as a peak and trough concentration) during the same dosing interval. These drug levels can either be obtained after the first dose is given (non-steady state) or once steady state is achieved (after the third dose is administered). The use of two drug concentrations allows for patient-specific estimations of all pharmacokinetic parameters using the [Sawchuk-Zaske method](https://clincalc.com/Vancomycin/#SawchukZaske).

![](https://clincalc.com/images/vancomycin/druglevel-two-firstdose.png)

Two drug levels (peak and trough) collected after a single dose (non-steady state)

![](https://clincalc.com/images/vancomycin/druglevel-two-ss.png)

Two drug levels (peak and trough) collected at steady state (after at least three doses)

Because vancomycin trough levels alone (one drug concentration) has been the standard for so long, some institutions may prefer to monitor drug therapy using a single vancomycin level (typically a trough level). This single drug level may be obtained after the first dose is given (non-steady state) or once steady state is achieved (after the third dose is administered). While a single drug level is less costly and more convenient, it requires [Bayesian modeling](https://clincalc.com/Vancomycin/#BayesianModeling) to estimate pharmacokinetic parameters and may not be as accurate as a two-level approach, particularly in patients with very altered pharmacokinetics (extreme obesity, critically ill, pregnancy, burns, etc.).

![](https://clincalc.com/images/vancomycin/druglevel-one-firstdose.png)

One drug level collected after a single dose (non-steady state)

![](https://clincalc.com/images/vancomycin/druglevel-one-ss.png)

One drug level collected at steady state (after at least three doses)

#### Vancomycin Loading Dose

In selected patients, a loading dose (25-30 mg/kg of total body weight; maximum 3000 mg) may be considered in order to achieve rapid attainment of serum concentrations. [12](https://clincalc.com/Vancomycin/#12) Patients who should be considered for a loading dose include those who are critically-ill, those receiving renal replacement therapy, or those receiving a continuous infusion of vancomycin. Note that this recommendation is made on the basis of expert opinion and is not supported by clinical trial data.

#### Inappropriate Populations for This Calculator

This calculator is NOT appropriate for the following patient populations or may require a higher degree of clinical judgment:

- Renal replacement therapy ( [see dosing recommendations instead](https://clincalc.com/Vancomycin/#RRT))
- Unstable renal function
- Vancomycin MIC ≥ 2 mcg/mL

- Pediatrics (< 18 years)
- Cystic fibrosis
- Severe burn injury

#### Dosing Recommendations for Renal Replacement Therapy (RRT)

Vancomycin dosing in patients receiving renal replacement therapy is complex and usually requires expert clinical judgment in conjunction with assessment of unique patient-specific factors. For example, blood flow rate, filter type, hemodialysis frequency or downtime, effluent rate, and residual renal function are among several factors that influence a patient's vancomycin dosing needs. The following are general considerations and recommendations for this patient population.

##### Intermittent Hemodialysis [12](https://clincalc.com/Vancomycin/\#12)

An initial loading dose of 25 mg/kg is recommended followed by 7.5 to 10 mg/kg after each hemodialysis session. Blood samples may be collected before dialysis (pre-dialysis) or 1-2 hours after dialysis (post-dialysis) and should be used to adjust maintenance dosing to a goal AUC/MIC between 400 to 600 mg\*h/L.

##### Sustained Low Efficiency Dialysis (SLED) [12](https://clincalc.com/Vancomycin/\#12), [13](https://clincalc.com/Vancomycin/\#13)

An initial loading dose of 20 to 25 mg/kg is recommended followed by 15 mg/kg after the end of each hybrid hemodialysis session. Blood samples may be collected before hybrid dialysis (pre-dialysis) or 1-2 hours after hybrid dialysis (post-dialysis) and should be used to adjust maintenance dosing to a goal AUC/MIC between 400 to 600 mg\*h/L.

##### Continuous Renal Replacement Therapy (CRRT) [14](https://clincalc.com/Vancomycin/\#14)

An initial loading dose of 15 to 25 mg/kg is recommended followed by a maintenance dose based on the CRRT modality (see below). Blood samples should be collected to adjust maintenance dosing to a goal AUC/MIC between 400 to 600 mg\*h/L.

- CVVH: 10 to 15 mg/kg every 24-48 hours
- CVVHD: 10 to 15 mg/kg every 24 hours or 7.5 mg/kg every 12 hours
- CVVHDF: 7.5 to 10 mg/kg every 12 hours

#### Frequently Asked Questions

**Will this vancomycin calculator remain free of charge?**

Yes, this website will continue to be available for free.


**Why doesn't this calculator use a volume of distribution (Vd) of 0.7 L/kg? Some pharmacokinetic textbooks use this value.**

A value of 0.7 L/kg is a convenient population estimate. Literature demonstrates highly variable values ranging from less than 0.5 L/kg (in morbidly obese patients) to greater than 1 L/kg (in non-obese critically ill patients). By default, this calculator uses Bayesian modeling population estimates to select an appropriate kinetic model based on critical illness and obesity. Users can select a variety of other Vd options, including 0.7 L/kg (Bauer method).


**Why did you pick Buelga 2005 as a general hospitalized Bayesian model?**

The Buelga model is a commonly selected in vancomycin Bayesian modeling and has been well studied in a variety of patient populations. Although the model was developed in patients with hematological malignancies, it has been validated in a more general cohort of hospitalized patients. Other models do exist that may have less bias and more precision (such as Goti et al. 2018); however, these models utilize a two-comparment approach. A core goal of this calculator is to provide transparency in how a vancomycin dose is calculated -- clinicians (and pharmacokinetic textbooks) utilize one-comparment pharmacokinetics; therefore, only one-comparment Bayesian models are considered for this calculator.


**What does it mean if the calculator indicates that Bayesian modeling did not demonstrate a good fit for the patient data?**

This error message is generated when the patient data provided cannot produce a model that matches to the patient's vancomycin level. In general, this error is produced in cases of data entry or laboratory error. For example, if a patient with very poor renal function (CrCl 20 mL/min) is given a very large dose (15 mg/kg IV Q8hr), the model would anticipate a very high trough level. Even with optimizing CLvanco and Vd, the model would likely not be able to match to the patient's measured drug level. When the model validates, the sum of squares (SS) would be high, indicating that the model was unable to fit well to the patient data provided.


### References and Additional Reading

01. Buelga DS, del Mar Fernandez de Gatta M, Herrera EV, et al. Population pharmacokinetic analysis of vancomycin in patients with hematological malignancies. _Antimicrob Agents Chemother_. 2005 Dec;49(12):4934-41. PMID [16304155](http://www.ncbi.nlm.nih.gov/pubmed/16304155).
02. Adane ED, Herald M, Koura F. Pharmacokinetics of vancomycin in extremely obese patients with suspected or confirmed Staphylococcus aureus infections. _Pharmacotherapy_. 2015 Feb;35(2):127-39. PMID [25644478](http://www.ncbi.nlm.nih.gov/pubmed/25644478).
03. Roberts JA, Taccone FS, Udy AA, et al. Vancomycin dosing in critically ill patients: robust methods for improved continuous-infusion regimens. _Antimicrob Agents Chemother_. 2011 Jun;55(6):2704-9. PMID [21402850](http://www.ncbi.nlm.nih.gov/pubmed/21402850).
04. Masich AM, Kalaria SN, Gonzales JP, et al. Vancomycin Pharmacokinetics in Obese Patients with Sepsis or Septic Shock. Pharmacotherapy. 2020 Mar;40(3):211-220. PMID [31957057](http://www.ncbi.nlm.nih.gov/pubmed/31957057).
05. Guo T, van Hest RM, Roggeveen LF, et al. External Evaluation of Population Pharmacokinetic Models of Vancomycin in Large Cohorts of Intensive Care Unit Patients. _Antimicrob Agents Chemother_. 2019 Apr 25;63(5). PMID [30833424](http://www.ncbi.nlm.nih.gov/pubmed/30833424).
06. Broeker A, Nardecchia M, Klinker KP, et al. Towards precision dosing of vancomycin: a systematic evaluation of pharmacometric models for Bayesian forecasting. _Clin Microbiol Infect_. 2019 Mar 11. pii: S1198-743X(19)30097-7. PMID [30872102](http://www.ncbi.nlm.nih.gov/pubmed/30872102).
07. Bauer LA. Applied Clinical Pharmacokinetics. McGraw-Hill/Appleton & Lange; 2001.
08. Matzke GR, McGory RW, Halstenson CE, Keane WF. Pharmacokinetics of vancomycin in patients with various degrees of renal function. _Antimicrob Agents Chemother_. 1984 Apr;25(4):433-7. PMID [6732213](http://www.ncbi.nlm.nih.gov/pubmed/6732213).
09. Rushing TA, Ambrose PJ. Clinical application and evaluation of vancomycin dosing in adults. _Journal of Pharmacy Technology_. 2001 Mar;17(2):33-8.
10. Dunn RD, Crass RL, Hong J, Pai MP, Krop LC. Vancomycin volume of distribution estimation in adults with class III obesity. _Am J Health Syst Pharm_. 2019 Dec 2;76(24):2013-2018. PMID [31630155](http://www.ncbi.nlm.nih.gov/pubmed/31630155).
11. Bauer LA. The Aminoglycoside Antibiotics. In: Bauer LA. eds. Applied Clinical Pharmacokinetics. 3rd Ed. New York, NY: 2014.
12. Rybak MJ, Le J, Lodise TP, et al. Therapeutic monitoring of vancomycin for serious methicillin-resistant Staphylococcus aureus infections: A revised consensus guideline and review by the American Society of Health-System Pharmacists, the Infectious Diseases Society of America, the Pediatric Infectious Diseases Society, and the Society of Infectious Diseases Pharmacists. _Am J Health Syst Pharm_. 2020 Mar 19. PMID [32191793](http://www.ncbi.nlm.nih.gov/pubmed/32191793).
13. Lewis SJ, Mueller BA. Development of a vancomycin dosing approach for critically ill patients receiving hybrid hemodialysis using Monte Carlo simulation. _SAGE Open Med_. 2018 May 11;6:2050312118773257. PMID [29780587](http://www.ncbi.nlm.nih.gov/pubmed/29780587).
14. Heintz BH, Matzke GR, Dager WE. Antimicrobial dosing concepts and recommendations for critically ill adult patients receiving continuous renal replacement therapy or intermittent hemodialysis. _Pharmacotherapy_. 2009 May;29(5):562-77. PMID [19397464](http://www.ncbi.nlm.nih.gov/pubmed/19397464).

### Search

### Mailing List

[Get Email Updates](http://eepurl.com/mXpuL)

### New and Popular

- [PREVENT 2023 ASCVD Risk Calculator](https://clincalc.com/Cardiology/PREVENT)
- [Introducing the PREVENT ASCVD Risk Calculator on ClinCalc.com](https://clincalc.com/blog/2025/09/introducing-the-prevent-ascvd-risk-calculator-on-clincalc-com/)
- [DrugStats Database](https://clincalc.com/DrugStats)
- [ASCVD Risk Calculator (Pooled Cohort Equations 2013)](https://clincalc.com/Cardiology/ASCVD/PooledCohort.aspx)
- [New Book Release: ClinCalc Pharmacy Crossword Review for the Top 250 Drugs](https://clincalc.com/blog/2025/11/new-book-release-clincalc-pharmacy-crossword-review-for-the-top-250-drugs/)
- [ClinCalc DrugStats: Most Commonly Prescribed Medications in 2023](https://clincalc.com/blog/2025/08/clincalc-drugstats-most-commonly-prescribed-medications-in-2023/)
- [Vancomycin Calculator](https://clincalc.com/Vancomycin)
- [Opioid Equianalgesic Calculator](https://clincalc.com/Opioids)

Open Menu


### Cite This Page

[Show AMA citation](https://clincalc.com/Vancomycin/#)

Kane SP. Vancomycin Calculator. ClinCalc: https://clincalc.com/Vancomycin. Updated September 6, 2025. Accessed March 18, 2026.


[![ICU Trials: Summarized critical care trials at your fingertips](https://clincalc.com/images/promo/icu_doctorinhall.jpg)![](<Base64-Image-Removed>)](https://clincalc.com/mobile/IcuTrials.aspx)

©2026 - ClinCalc LLC. All rights reserved.


- [Home](https://clincalc.com/)
- [Academy](https://academy.clincalc.com/)
- [Blog](https://clincalc.com/blog)
- [About](https://clincalc.com/About.aspx)

[Disclaimer](https://clincalc.com/Disclaimer.aspx) \- [Privacy Policy](https://clincalc.com/Privacy.aspx) \- [Contact Us](https://clincalc.com/About.aspx)

Updated Sep 6, 2025

Back to Top

Top

|     |     |
| --- | --- |
| **Default infusion time** | 1000 mg/hr750 mg/hr500 mg/hr |
| **Infusion time rounding** | Nearest 15 min (0.25 hrs)Nearest 30 min (0.5 hrs) |
| **MIC of organism** | mcg/mL |
|  |

×

March

January

February

March

April

May

June

July

August

September

October

November

December

2026

1950

1951

1952

1953

1954

1955

1956

1957

1958

1959

1960

1961

1962

1963

1964

1965

1966

1967

1968

1969

1970

1971

1972

1973

1974

1975

1976

1977

1978

1979

1980

1981

1982

1983

1984

1985

1986

1987

1988

1989

1990

1991

1992

1993

1994

1995

1996

1997

1998

1999

2000

2001

2002

2003

2004

2005

2006

2007

2008

2009

2010

2011

2012

2013

2014

2015

2016

2017

2018

2019

2020

2021

2022

2023

2024

2025

2026

2027

2028

2029

2030

2031

2032

2033

2034

2035

2036

2037

2038

2039

2040

2041

2042

2043

2044

2045

2046

2047

2048

2049

2050

| Sun | Mon | Tue | Wed | Thu | Fri | Sat |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 2 | 3 | 4 | 5 | 6 | 7 |
| 8 | 9 | 10 | 11 | 12 | 13 | 14 |
| 15 | 16 | 17 | 18 | 19 | 20 | 21 |
| 22 | 23 | 24 | 25 | 26 | 27 | 28 |
| 29 | 30 | 31 | 1 | 2 | 3 | 4 |

Save Selected

00:00

00:15

00:30

00:45

01:00

01:15

01:30

01:45

02:00

02:15

02:30

02:45

03:00

03:15

03:30

03:45

04:00

04:15

04:30

04:45

05:00

05:15

05:30

05:45

06:00

06:15

06:30

06:45

07:00

07:15

07:30

07:45

08:00

08:15

08:30

08:45

09:00

09:15

09:30

09:45

10:00

10:15

10:30

10:45

11:00

11:15

11:30

11:45

12:00

12:15

12:30

12:45

13:00

13:15

13:30

13:45

14:00

14:15

14:30

14:45

15:00

15:15

15:30

15:45

16:00

16:15

16:30

16:45

17:00

17:15

17:30

17:45

18:00

18:15

18:30

18:45

19:00

19:15

19:30

19:45

20:00

20:15

20:30

20:45

21:00

21:15

21:30

21:45

22:00

22:15

22:30

22:45

23:00

23:15

23:30

23:45

March

January

February

March

April

May

June

July

August

September

October

November

December

2026

1950

1951

1952

1953

1954

1955

1956

1957

1958

1959

1960

1961

1962

1963

1964

1965

1966

1967

1968

1969

1970

1971

1972

1973

1974

1975

1976

1977

1978

1979

1980

1981

1982

1983

1984

1985

1986

1987

1988

1989

1990

1991

1992

1993

1994

1995

1996

1997

1998

1999

2000

2001

2002

2003

2004

2005

2006

2007

2008

2009

2010

2011

2012

2013

2014

2015

2016

2017

2018

2019

2020

2021

2022

2023

2024

2025

2026

2027

2028

2029

2030

2031

2032

2033

2034

2035

2036

2037

2038

2039

2040

2041

2042

2043

2044

2045

2046

2047

2048

2049

2050

| Sun | Mon | Tue | Wed | Thu | Fri | Sat |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 2 | 3 | 4 | 5 | 6 | 7 |
| 8 | 9 | 10 | 11 | 12 | 13 | 14 |
| 15 | 16 | 17 | 18 | 19 | 20 | 21 |
| 22 | 23 | 24 | 25 | 26 | 27 | 28 |
| 29 | 30 | 31 | 1 | 2 | 3 | 4 |

Save Selected

00:00

00:15

00:30

00:45

01:00

01:15

01:30

01:45

02:00

02:15

02:30

02:45

03:00

03:15

03:30

03:45

04:00

04:15

04:30

04:45

05:00

05:15

05:30

05:45

06:00

06:15

06:30

06:45

07:00

07:15

07:30

07:45

08:00

08:15

08:30

08:45

09:00

09:15

09:30

09:45

10:00

10:15

10:30

10:45

11:00

11:15

11:30

11:45

12:00

12:15

12:30

12:45

13:00

13:15

13:30

13:45

14:00

14:15

14:30

14:45

15:00

15:15

15:30

15:45

16:00

16:15

16:30

16:45

17:00

17:15

17:30

17:45

18:00

18:15

18:30

18:45

19:00

19:15

19:30

19:45

20:00

20:15

20:30

20:45

21:00

21:15

21:30

21:45

22:00

22:15

22:30

22:45

23:00

23:15

23:30

23:45

March

January

February

March

April

May

June

July

August

September

October

November

December

2026

1950

1951

1952

1953

1954

1955

1956

1957

1958

1959

1960

1961

1962

1963

1964

1965

1966

1967

1968

1969

1970

1971

1972

1973

1974

1975

1976

1977

1978

1979

1980

1981

1982

1983

1984

1985

1986

1987

1988

1989

1990

1991

1992

1993

1994

1995

1996

1997

1998

1999

2000

2001

2002

2003

2004

2005

2006

2007

2008

2009

2010

2011

2012

2013

2014

2015

2016

2017

2018

2019

2020

2021

2022

2023

2024

2025

2026

2027

2028

2029

2030

2031

2032

2033

2034

2035

2036

2037

2038

2039

2040

2041

2042

2043

2044

2045

2046

2047

2048

2049

2050

| Sun | Mon | Tue | Wed | Thu | Fri | Sat |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 2 | 3 | 4 | 5 | 6 | 7 |
| 8 | 9 | 10 | 11 | 12 | 13 | 14 |
| 15 | 16 | 17 | 18 | 19 | 20 | 21 |
| 22 | 23 | 24 | 25 | 26 | 27 | 28 |
| 29 | 30 | 31 | 1 | 2 | 3 | 4 |

Save Selected

00:00

00:15

00:30

00:45

01:00

01:15

01:30

01:45

02:00

02:15

02:30

02:45

03:00

03:15

03:30

03:45

04:00

04:15

04:30

04:45

05:00

05:15

05:30

05:45

06:00

06:15

06:30

06:45

07:00

07:15

07:30

07:45

08:00

08:15

08:30

08:45

09:00

09:15

09:30

09:45

10:00

10:15

10:30

10:45

11:00

11:15

11:30

11:45

12:00

12:15

12:30

12:45

13:00

13:15

13:30

13:45

14:00

14:15

14:30

14:45

15:00

15:15

15:30

15:45

16:00

16:15

16:30

16:45

17:00

17:15

17:30

17:45

18:00

18:15

18:30

18:45

19:00

19:15

19:30

19:45

20:00

20:15

20:30

20:45

21:00

21:15

21:30

21:45

22:00

22:15

22:30

22:45

23:00

23:15

23:30

23:45